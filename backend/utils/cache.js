// backend/utils/cache.js

class SimpleCache {
    constructor(ttlSeconds = 300) { // Default TTL: 5 menit
        this.cache = {};
        this.ttl = ttlSeconds * 1000;
    }

    set(key, value) {
        this.cache[key] = {
            value,
            timestamp: Date.now()
        };
        console.log(`✅ Cache set for key: ${key}`);
    }

    get(key) {
        const item = this.cache[key];
        if (!item) return null;
        
        if (Date.now() - item.timestamp > this.ttl) {
            // Cache expired
            delete this.cache[key];
            console.log(`⏰ Cache expired for key: ${key}`);
            return null;
        }
        
        console.log(`✅ Cache hit for key: ${key}`);
        return item.value;
    }

    clear() {
        this.cache = {};
        console.log('🧹 Cache cleared');
    }
}

module.exports = new SimpleCache();