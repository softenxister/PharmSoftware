-- Rename the canonical store payment label while preserving existing choices.
UPDATE "StorePosSettings"
SET
    "paymentMethods" = (
        SELECT jsonb_agg(
            CASE
                WHEN method = 'Mobile payment' THEN 'Bank transfer'
                ELSE method
            END
            ORDER BY position
        )
        FROM jsonb_array_elements_text("StorePosSettings"."paymentMethods")
            WITH ORDINALITY AS methods(method, position)
    ),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "paymentMethods" ? 'Mobile payment';

-- Keep previously saved and seeded sales consistent with the renamed option.
UPDATE "Sale"
SET "paymentMethod" = 'Bank transfer'
WHERE "paymentMethod" IN ('Mobile payment', 'PromptPay');
