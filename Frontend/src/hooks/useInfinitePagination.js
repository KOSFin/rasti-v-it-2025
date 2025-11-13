import { useCallback, useEffect, useRef, useState } from 'react';

export default function useInfinitePagination(fetchPage, {
  initialParams = {},
  pageSize = 20,
  auto = true,
} = {}) {
  const paramsRef = useRef({ ...initialParams });
  const nextRef = useRef(null);
  const loadingRef = useRef(false);

  const [items, setItems] = useState([]);
  const [count, setCount] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [version, setVersion] = useState(0);

  const normalize = useCallback((payload) => {
    const data = payload?.data ?? payload ?? {};
    const results = Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data)
        ? data
        : Array.isArray(data?.data?.results)
          ? data.data.results
          : data?.results
            ? data.results
            : [];
    return {
      results,
      next: data?.next ?? null,
      count: typeof data?.count === 'number' ? data.count : (Array.isArray(results) ? results.length : 0),
    };
  }, []);

  const loadPage = useCallback(async ({ replace = false } = {}) => {
    if (loadingRef.current) {
      return;
    }
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const requestConfig = {};
      if (replace || !nextRef.current) {
        requestConfig.params = { page_size: pageSize, ...paramsRef.current };
      } else {
        requestConfig.url = nextRef.current;
      }
      const response = await fetchPage(requestConfig);
      const { results, next, count: total } = normalize(response);

      nextRef.current = next;
      setHasMore(Boolean(next));
      if (typeof total === 'number') {
        setCount(total);
      }
      setItems((prev) => (replace ? results : [...prev, ...results]));
    } catch (err) {
      setError(err);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [fetchPage, normalize, pageSize]);

  const reload = useCallback(async () => {
    nextRef.current = null;
    setItems([]);
    await loadPage({ replace: true });
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore && nextRef.current === null && items.length > 0) {
      return;
    }
    await loadPage({ replace: false });
  }, [hasMore, items.length, loadPage]);

  const setParams = useCallback((nextParams) => {
    const resolved = typeof nextParams === 'function'
      ? nextParams(paramsRef.current)
      : nextParams;
    paramsRef.current = {
      ...Object.fromEntries(Object.entries(resolved || {}).filter(([, value]) => value !== undefined && value !== '')),
    };
    nextRef.current = null;
    setItems([]);
    setVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!auto) {
      return;
    }
    reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, auto]);

  useEffect(() => {
    if (!auto) {
      return;
    }
    if (version === 0 && items.length === 0) {
      reload();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    items,
    count,
    error,
    loading,
    hasMore,
    loadMore,
    reload,
    setParams,
    params: paramsRef.current,
  };
}
