CREATE OR REPLACE FUNCTION get_student_balance(student_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
  balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN transaction_type IN ('earn', 'grant', 'quiz_complete', 'purchase_refund') THEN amount
      WHEN transaction_type IN ('spend', 'deduct', 'purchase') THEN -amount
      ELSE 0
    END
  ), 0)
  INTO balance
  FROM currency_transactions
  WHERE student_id = student_id_param;
  
  RETURN balance;
END;
$$ LANGUAGE plpgsql STABLE;