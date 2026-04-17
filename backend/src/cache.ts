// Shared in-memory caches

// storeId → odoo_location_id (cleared when store is updated)
export const locationCache = new Map<number, number | null>();
