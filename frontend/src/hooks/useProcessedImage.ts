import { useState, useEffect } from 'react';
import { processProductImage, PLACEHOLDER_IMAGE } from '../utils/imageUtils';

export function useProcessedImage(base64?: string) {
  const [processedUrl, setProcessedUrl] = useState<string>(PLACEHOLDER_IMAGE);
  const [loading, setLoading] = useState(!!base64);

  useEffect(() => {
    if (!base64) {
      setProcessedUrl(PLACEHOLDER_IMAGE);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    processProductImage(base64).then((url) => {
      if (isMounted) {
        setProcessedUrl(url);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [base64]);

  return { processedUrl, loading };
}
