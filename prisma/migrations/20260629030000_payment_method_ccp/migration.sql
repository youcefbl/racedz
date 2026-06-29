-- Add CCP (Algérie Poste) as a distinct manual payment method.
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CCP';
