const myModule = require('./main');
const parseHeader = myModule.parseHeader;

//todo maybe do parseHeader properly with a library
test('parseHeader', () => {

    // test null/undefined

    expect(parseHeader(undefined)).toBeNull();
    expect(parseHeader(null)).toBeNull();

    // test std

    let header = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next"';
    let map = new Map();
    map.set('next','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2');
    let out = parseHeader(header);
    expect(areEqual(map,out)).toBeTruthy();

    header = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next", ' +
        '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"'
    map = new Map();
    map.set('next','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2');
    map.set('last','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34');
    out = parseHeader(header);
    expect(areEqual(map,out)).toBeTruthy();

    header = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=15>; rel="next", ' +
        '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last", ' +
        '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=1>; rel="first", ' +
        '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=13>; rel="prev"'
    map.set('next','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2');
    map.set('last','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34');
    map.set('first','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=1');
    map.set('prev','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=13');
    out = parseHeader(header);
    expect(areEqual(map,out)).toBeTruthy();

    // test invalid input

    expect(parseHeader()).toBe(null);

    header = 'https://api.github.com/search/code?q=addClass+user%3Amozilla&page=15; rel="next"'
    expect(parseHeader(header)).toBeNull();

    header = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=15>'
    expect(parseHeader(header)).toBeNull();

    header = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=15>; "nxt"'
    expect(parseHeader(header)).toBeNull();

    //todo
    // header = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next" ' +
    //     '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"'
    // expect(parseHeader(header)).toBeNull();
});

/**
 * checks if two maps are equivalent
 * @param map1 first map
 * @param map2 second map
 * @returns {boolean}
 */
function areEqual(map1, map2) {
    if (!map1.size === map2.size) return false;//todo
    map1.forEach((v,k)=>{
        if (!map2.has(k)) return false;
        if (!map2.get(k) === v) return false;
    });
    return true;
}