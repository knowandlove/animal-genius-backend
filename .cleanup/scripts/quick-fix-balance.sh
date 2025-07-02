#!/bin/bash

# Load environment variables
source .env

# Just fix the one SQL function causing the error
echo "Fixing get_student_balance function..."
psql "$DATABASE_URL" << EOF
CREATE OR REPLACE FUNCTION get_student_balance(p_student_id UUID)
RETURNS INTEGER AS \$\$
DECLARE
    total_balance INTEGER;
BEGIN
    SELECT COALESCE(SUM(amount), 0)
    INTO total_balance
    FROM currency_transactions
    WHERE student_id = p_student_id;
    
    RETURN total_balance;
END;
\$\$ LANGUAGE plpgsql;
EOF

echo "Done! The analytics page should work now."
