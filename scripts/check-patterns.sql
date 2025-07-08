-- Check pattern values
SELECT 
  p.id,
  p.code,
  p.name,
  p.pattern_type,
  p.pattern_value,
  p.surface_type
FROM patterns p
JOIN store_items si ON si.pattern_id = p.id
JOIN student_inventory inv ON inv.store_item_id = si.id
WHERE inv.student_id = '0197c45d-3cfe-73d2-9079-8617c6793f54';