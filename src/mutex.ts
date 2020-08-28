/**
 * Implements a mutex in the form of a chain of promises, each lock request adding a then() clause to the chain.
 * Resolving the then clause is what unlocks the mutex, allowing the next request in line to have it.
 * If the mutext isn't currently locked (no pending then() clauses), the requested lock will activate immediately.
 * Otherwise, the request will have to wait (FIFO).
 *
 *      const myResourceMutex = new Mutex();
 *      ...
 *      const unlock = await myResourceMutex.lock();
 *      try {
 *          ...
 *      } finally {
 *          unlock();
 *      }
 *
 * See https://spin.atomicobject.com/2018/09/10/javascript-concurrency/
 */
export class Mutex {
    // Initialize the mutex to be empty
    private mutex = Promise.resolve();

    /**
     * Call `lock()` to request a lock on this mutex.
     * This returns a Promise that eventually resolves to an `unlock()` callback function.
     * As long as the promise is pending, you don't have the lock yet.
     * Once the promise resolves, you gain the lock.
     * When you are done with the protected resource, call the unlock() function to release it.
     */
    lock(caller: string = "unknown"): PromiseLike<() => void> {
        console.log(`Mutex locked by ${caller}`);
        // The `begin` function creates an `unlock` function for the client code to call when it no longer needs the resource.
        // `begin` is just a proxy to start, but, by the time it is actually invoked it will be a different function.
        let begin: (unlock: () => void) => void = unlock => { };

        // Hang (another) lock-request on the mutex -- in the form of a then() clause that calls `begin`.
        this.mutex = this.mutex.then(() => {
            // console.log(`Mutex for ${caller} unlocked.`);
            return new Promise(begin);
        });

        return new Promise(res => { begin = res; });
    }

    async dispatch(fn: (() => any) | (() => PromiseLike<any>)): Promise<any> {
        const unlock = await this.lock();
        try {
            return await Promise.resolve(fn());
        } finally {
            unlock();
        }
    }
}