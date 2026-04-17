import { useState, useEffect } from 'react';

export function useOdoo() {
  const [categories, setCategories] = useState<any[]>([]);
  const [productCache, setProductCache] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(false); // Immediate start
  const [syncing, setSyncing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInitial = async () => {
    setSyncing(true);
    try {
      const response = await fetch('http://localhost:3001/api/odoo/init');
      const data = await response.json();
      setCategories(data.categories || []);
      setSyncing(false);
    } catch (err: any) {
      setError(err.message);
      setSyncing(false);
    }
  };

  const fetchCategoryProducts = async (categoryId: number) => {
    // Return from cache if available
    if (productCache[categoryId]) return productCache[categoryId];

    console.log(`[LazyLoad] Fetching Odoo products for Category ID: ${categoryId}...`);
    try {
      const response = await fetch(`http://localhost:3001/api/odoo/products?category=${categoryId}`);
      const data = await response.json();
      const prods = data.products || [];
      
      setProductCache(prev => ({ ...prev, [categoryId]: prods }));
      return prods;
    } catch (err) {
      console.error('Fetch error:', err);
      return [];
    }
  };

  useEffect(() => {
    fetchInitial();
  }, []);

  return { 
    categories, 
    productCache, 
    fetchCategoryProducts, 
    loading, 
    syncing,
    error,
    refresh: fetchInitial
  };
}
