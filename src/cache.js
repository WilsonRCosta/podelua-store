const { cacheTtlMs } = require('./config');

// Wraps an async loader with a TTL cache. Concurrent callers share one in-flight request,
// so a burst of requests on a cold cache only hits Airtable once.
function createCache(loader, ttlMs = cacheTtlMs) {
  let data = null;
  let fetchedAt = 0;
  let pending = null;

  async function get() {
    if (data && Date.now() - fetchedAt < ttlMs) return data;
    if (!pending) {
      pending = loader()
        .then((result) => {
          data = result;
          fetchedAt = Date.now();
          return result;
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  }

  // Last successfully loaded value, even if expired.
  get.stale = () => data;

  return get;
}

module.exports = { createCache };
