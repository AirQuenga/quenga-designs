-- Fix incorrect name/address for Bidwell's Hill Apartments
-- Was: "Bidwell's Wells Apartments"
-- Correct: "Bidwell's Hill Apartments" at 500 Esplanade, Chico, CA 95926

UPDATE properties
SET
  property_name = 'Bidwell''s Hill Apartments',
  address = '500 Esplanade',
  city = 'Chico',
  state = 'CA',
  zip_code = '95926',
  updated_at = NOW()
WHERE
  property_name ILIKE '%Bidwell%Wells%'
  OR (property_name ILIKE '%Bidwell%' AND address ILIKE '%Esplanade%');

-- Verify the change
SELECT id, property_name, address, city, state, zip_code
FROM properties
WHERE property_name ILIKE '%Bidwell%';
