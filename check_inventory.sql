SELECT 
  i.id,
  i.productId,
  p.description as productName,
  i.quantity,
  i.locationId,
  wl.code as locationCode,
  i.batch,
  i.expiryDate,
  i.status
FROM inventory i
LEFT JOIN products p ON i.productId = p.id
LEFT JOIN warehouseLocations wl ON i.locationId = wl.id
WHERE i.productId = 180001
  AND i.status = 'available'
  AND i.quantity > 0
ORDER BY i.createdAt ASC;
