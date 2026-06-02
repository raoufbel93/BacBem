/**
 * Polyfills for Windows 7 / IE11 compatibility
 * Required for React and modern JavaScript features
 */

// Object.assign polyfill
if (typeof Object.assign !== 'function') {
    Object.assign = function (target) {
        if (target === null || target === undefined) {
            throw new TypeError('Cannot convert undefined or null to object');
        }
        var to = Object(target);
        for (var index = 1; index < arguments.length; index++) {
            var nextSource = arguments[index];
            if (nextSource !== null && nextSource !== undefined) {
                for (var nextKey in nextSource) {
                    if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                        to[nextKey] = nextSource[nextKey];
                    }
                }
            }
        }
        return to;
    };
}

// Array.from polyfill
if (!Array.from) {
    Array.from = function (arrayLike, mapFn, thisArg) {
        var arr = [];
        var len = arrayLike.length;
        for (var i = 0; i < len; i++) {
            if (mapFn) {
                arr.push(mapFn.call(thisArg, arrayLike[i], i));
            } else {
                arr.push(arrayLike[i]);
            }
        }
        return arr;
    };
}

// Array.prototype.find polyfill
if (!Array.prototype.find) {
    Array.prototype.find = function (predicate) {
        if (this === null || this === undefined) {
            throw new TypeError('Array.prototype.find called on null or undefined');
        }
        if (typeof predicate !== 'function') {
            throw new TypeError('predicate must be a function');
        }
        var list = Object(this);
        var length = list.length >>> 0;
        var thisArg = arguments[1];
        for (var i = 0; i < length; i++) {
            var value = list[i];
            if (predicate.call(thisArg, value, i, list)) {
                return value;
            }
        }
        return undefined;
    };
}

// Array.prototype.includes polyfill
if (!Array.prototype.includes) {
    Array.prototype.includes = function (searchElement, fromIndex) {
        if (this === null || this === undefined) {
            throw new TypeError('Array.prototype.includes called on null or undefined');
        }
        var o = Object(this);
        var len = o.length >>> 0;
        if (len === 0) return false;
        var n = fromIndex | 0;
        var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
        while (k < len) {
            if (o[k] === searchElement) return true;
            k++;
        }
        return false;
    };
}

// String.prototype.endsWith polyfill
if (!String.prototype.endsWith) {
    String.prototype.endsWith = function (search, this_len) {
        if (this_len === undefined || this_len > this.length) {
            this_len = this.length;
        }
        return this.substring(this_len - search.length, this_len) === search;
    };
}

// String.prototype.includes polyfill
if (!String.prototype.includes) {
    String.prototype.includes = function (search, start) {
        if (typeof start !== 'number') start = 0;
        if (start + search.length > this.length) return false;
        return this.indexOf(search, start) !== -1;
    };
}

console.log('Polyfills loaded for Windows 7/IE11 compatibility');
