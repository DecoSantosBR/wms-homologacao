SELECT 
  id,
  productId,
  locationId,
  locationZone,
  quantity,
  uniqueCode
FROM inventory
WHERE locationZone = 'REC'
ORDER BY id DESC
LIMIT 10;
