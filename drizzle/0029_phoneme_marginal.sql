-- Marginal phoneme flag: phonemes that exist in the language but are
-- restricted (loanwords, ideophones, archaic speech). Wikipedia convention
-- renders these in parentheses "(θ)" in the inventory grid.

ALTER TABLE phonemes
  ADD COLUMN IF NOT EXISTS marginal BOOLEAN NOT NULL DEFAULT false;
