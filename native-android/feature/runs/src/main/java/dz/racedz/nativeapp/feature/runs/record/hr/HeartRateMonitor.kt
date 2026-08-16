package dz.racedz.nativeapp.feature.runs.record.hr

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import androidx.core.content.ContextCompat
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * BLE heart-rate sensor (NATRUN-07.3; contract §07.3 in docs/RUNS_STRAVA_PARITY_2026-08-16.md).
 *
 * One connection, notify-only on the standard Heart Rate Measurement characteristic, reconnect
 * with backoff while a recording is live, and a state that says exactly what is happening — the
 * live tile shows a number only in [State.Connected]. Nothing is ever estimated.
 *
 * Runs on the main looper (Android's BLE callbacks arrive on binder threads; state is published
 * through a StateFlow, which is thread-safe). Owned by the tracking service for the life of a
 * recording; the start screen uses [scan] alone to pick a device.
 */
class HeartRateMonitor(private val context: Context) {

    sealed interface State {
        data object Off : State
        data object Unsupported : State
        data object PermissionNeeded : State
        data object Searching : State
        data class Connected(val bpm: Int?, val name: String?) : State
        data object Reconnecting : State
        data object NotFound : State
    }

    class Found(val address: String, val name: String?)

    private val _state = MutableStateFlow<State>(State.Off)
    val state: StateFlow<State> = _state.asStateFlow()

    /** Live samples for the recorder; called on a binder thread. */
    var onSample: ((Int) -> Unit)? = null

    private val handler = Handler(Looper.getMainLooper())
    private val adapter: BluetoothAdapter? get() = (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
    private var gatt: BluetoothGatt? = null
    private var targetAddress: String? = null
    private var attempts = 0
    private var wantConnected = false

    val supported: Boolean
        get() = context.packageManager.hasSystemFeature(PackageManager.FEATURE_BLUETOOTH_LE) && adapter != null

    fun hasPermissions(): Boolean = requiredPermissions().all {
        ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
    }

    /** What to ask for, by API level; the start-screen row requests exactly these. */
    fun requiredPermissions(): List<String> = if (Build.VERSION.SDK_INT >= 31) {
        listOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
    } else {
        // Pre-31 BLE scanning is gated on location, which the app already holds for GPS.
        listOf(Manifest.permission.ACCESS_FINE_LOCATION)
    }

    // ---- scanning (start screen picker) ---------------------------------------------------

    private var scanCallback: ScanCallback? = null

    /** Scans for [durationMs] for devices advertising the Heart Rate service. */
    @SuppressLint("MissingPermission")
    fun scan(durationMs: Long = 15_000, onFound: (Found) -> Unit, onDone: () -> Unit) {
        if (!supported) { _state.value = State.Unsupported; onDone(); return }
        if (!hasPermissions()) { _state.value = State.PermissionNeeded; onDone(); return }
        val scanner = adapter?.bluetoothLeScanner ?: run { _state.value = State.Unsupported; onDone(); return }
        stopScan()
        _state.value = State.Searching
        val seen = HashSet<String>()
        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val address = result.device.address ?: return
                if (seen.add(address)) onFound(Found(address, runCatching { result.device.name }.getOrNull() ?: result.scanRecord?.deviceName))
            }
            override fun onScanFailed(errorCode: Int) { stopScan(); _state.value = State.NotFound; onDone() }
        }
        scanCallback = callback
        val filter = ScanFilter.Builder().setServiceUuid(ParcelUuid(HEART_RATE_SERVICE)).build()
        val settings = ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build()
        runCatching { scanner.startScan(listOf(filter), settings, callback) }
            .onFailure { _state.value = State.NotFound; onDone(); return }
        handler.postDelayed({
            stopScan()
            if (_state.value == State.Searching) _state.value = if (seen.isEmpty()) State.NotFound else State.Off
            onDone()
        }, durationMs)
    }

    @SuppressLint("MissingPermission")
    fun stopScan() {
        val cb = scanCallback ?: return
        scanCallback = null
        runCatching { adapter?.bluetoothLeScanner?.stopScan(cb) }
    }

    // ---- connection (recording) -----------------------------------------------------------

    /** Connects to the remembered sensor and keeps trying while the recording lives. */
    @SuppressLint("MissingPermission")
    fun connect(address: String) {
        if (!supported) { _state.value = State.Unsupported; return }
        if (!hasPermissions()) { _state.value = State.PermissionNeeded; return }
        targetAddress = address
        wantConnected = true
        attempts = 0
        _state.value = State.Searching
        openGatt()
    }

    @SuppressLint("MissingPermission")
    private fun openGatt() {
        val address = targetAddress ?: return
        val device: BluetoothDevice = runCatching { adapter?.getRemoteDevice(address) }.getOrNull() ?: run {
            _state.value = State.NotFound; return
        }
        runCatching { gatt?.close() }
        gatt = device.connectGatt(context, false, callback, BluetoothDevice.TRANSPORT_LE)
    }

    private val callback = object : BluetoothGattCallback() {
        @SuppressLint("MissingPermission")
        override fun onConnectionStateChange(g: BluetoothGatt, status: Int, newState: Int) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                attempts = 0
                g.discoverServices()
            } else if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                runCatching { g.close() }
                if (gatt === g) gatt = null
                if (wantConnected) scheduleReconnect() else _state.value = State.Off
            }
        }

        @SuppressLint("MissingPermission")
        override fun onServicesDiscovered(g: BluetoothGatt, status: Int) {
            val characteristic = g.getService(HEART_RATE_SERVICE)?.getCharacteristic(HEART_RATE_MEASUREMENT)
            if (characteristic == null) { _state.value = State.NotFound; wantConnected = false; runCatching { g.disconnect() }; return }
            g.setCharacteristicNotification(characteristic, true)
            val descriptor = characteristic.getDescriptor(CLIENT_CONFIG) ?: return
            if (Build.VERSION.SDK_INT >= 33) {
                g.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)
            } else {
                @Suppress("DEPRECATION")
                descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                @Suppress("DEPRECATION")
                g.writeDescriptor(descriptor)
            }
            _state.value = State.Connected(bpm = null, name = runCatching { g.device.name }.getOrNull())
        }

        override fun onCharacteristicChanged(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
            deliver(characteristic, value)
        }

        @Deprecated("Deprecated in Java")
        override fun onCharacteristicChanged(g: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            @Suppress("DEPRECATION")
            deliver(characteristic, characteristic.value)
        }

        private fun deliver(characteristic: BluetoothGattCharacteristic, value: ByteArray?) {
            if (characteristic.uuid != HEART_RATE_MEASUREMENT) return
            val bpm = HeartRateParser.parse(value) ?: return
            val current = _state.value
            _state.value = State.Connected(bpm, (current as? State.Connected)?.name)
            onSample?.invoke(bpm)
        }
    }

    private fun scheduleReconnect() {
        _state.value = State.Reconnecting
        attempts += 1
        if (attempts > MAX_RECONNECTS) { _state.value = State.NotFound; wantConnected = false; return }
        val delay = (2_000L * (1 shl (attempts - 1).coerceAtMost(4))).coerceAtMost(30_000L)
        handler.postDelayed({ if (wantConnected) openGatt() }, delay)
    }

    @SuppressLint("MissingPermission")
    fun disconnect() {
        wantConnected = false
        handler.removeCallbacksAndMessages(null)
        stopScan()
        runCatching { gatt?.disconnect(); gatt?.close() }
        gatt = null
        _state.value = State.Off
    }

    companion object {
        val HEART_RATE_SERVICE: UUID = UUID.fromString("0000180d-0000-1000-8000-00805f9b34fb")
        val HEART_RATE_MEASUREMENT: UUID = UUID.fromString("00002a37-0000-1000-8000-00805f9b34fb")
        val CLIENT_CONFIG: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
        private const val MAX_RECONNECTS = 8

        /** One monitor for the process: the service connects, the screens observe. */
        @Volatile private var shared: HeartRateMonitor? = null
        fun shared(context: Context): HeartRateMonitor =
            shared ?: synchronized(this) { shared ?: HeartRateMonitor(context.applicationContext).also { shared = it } }
    }
}
