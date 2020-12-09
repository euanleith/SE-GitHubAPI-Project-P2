const myModule = require('./main');
const EXPIRY_TIME = myModule.EXPIRY_TIME;
const getNPages = myModule.getNPages;
const parseLinkHeader = myModule.parseLinkHeader;
const addCookie = myModule.addCookie;
const getCookie = myModule.getCookie;
const cluster = myModule.cluster;
const max = myModule.max;
const getToken = myModule.getToken;

//todo maybe do parseLinkHeader properly with a library
test('parseLinkHeader & getNPages', () => {

    // test null/undefined/empty

    expect(parseLinkHeader()).toBeNull();
    expect(parseLinkHeader(undefined)).toBeNull();
    expect(parseLinkHeader(null)).toBeNull();
    expect(parseLinkHeader('')).toBe(null);

    expect(getNPages()).toBe(1);
    expect(getNPages(undefined)).toBe(1);
    expect(getNPages(null)).toBe(1);
    expect(getNPages('')).toBe(1);

    // test std

    let header = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next"';
    let map = new Map();
    map.set('next','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2');
    let out = parseLinkHeader(header);
    expect(out).toEqual(map);
    expect(getNPages(header)).toBeNull();

    header = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next", ' +
        '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"'
    map = new Map();
    map.set('next','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2');
    map.set('last','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34');
    out = parseLinkHeader(header);
    expect(out).toEqual(map);
    expect(getNPages(header)).toBe(34);

    header = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=3>; rel="next", ' +
        '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=4>; rel="last", ' +
        '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=1>; rel="first", ' +
        '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=1>; rel="prev"'
    map.set('next','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=3');
    map.set('last','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=4');
    map.set('first','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=1');
    map.set('prev','https://api.github.com/search/code?q=addClass+user%3Amozilla&page=1');
    out = parseLinkHeader(header);
    expect(out).toEqual(map);
    expect(getNPages(header)).toBe(4);

    // test invalid

    header = 'https://api.github.com/search/code?q=addClass+user%3Amozilla&page=15; rel="next"'
    expect(parseLinkHeader(header)).toBeNull();
    expect(getNPages(header)).toBeNull();

    header = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=15>'
    expect(parseLinkHeader(header)).toBeNull();
    expect(getNPages(header)).toBeNull();

    header = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=15>; "nxt"'
    expect(parseLinkHeader(header)).toBeNull();
    expect(getNPages(header)).toBeNull();

    //todo
    // header = '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=2>; rel="next" ' +
    //     '<https://api.github.com/search/code?q=addClass+user%3Amozilla&page=34>; rel="last"'
    // expect(parseLinkHeader(header)).toBeNull();
    // expect(getNPages(header)).toBeNull();
});

test('addCookie & getCookie', () => {

    // test undefined/null/empty

    document.cookie = undefined;
    expect(addCookie()).toBeNull();
    expect(addCookie(undefined)).toBeNull();
    expect(document.cookie).toBe('undefined');
    expect(addCookie('',{k1:'v1'})).toBeNull();
    expect(addCookie('',{})).toBeNull();
    expect(JSON.stringify(addCookie('key',{}))).toMatch(/{"key":{"value":{},"expires":.+}}/);
    expect(getCookie('key')).toEqual({});

    expect(getCookie()).toBeUndefined();
    expect(getCookie(undefined)).toBeUndefined();
    expect(getCookie(null)).toBeUndefined();
    expect(getCookie('')).toBeUndefined();

    // test std

    document.cookie = undefined;
    let key = 'key1';
    let val = {k1:'v1',k2:'v2'};
    expect(JSON.stringify(addCookie(key, val))).toMatch(/{"key1":{"value":{"k1":"v1","k2":"v2"},"expires":.+}}/);
    expect(document.cookie).toMatch(/{"key1":{"value":{"k1":"v1","k2":"v2"},"expires":.+}}/);
    expect(getCookie(key)).toEqual(val);

    key = 'key2';
    val = {k1:{k11:'v11',k12:'v12'},k2:'v2',k3:'v3'};
    let cookie = addCookie(key, val);
    expect(JSON.stringify(cookie)).toMatch(/{"key1":{"value":{"k1":"v1","k2":"v2"},"expires":.+},"key2":{"value":{"k1":{"k11":"v11","k12":"v12"},"k2":"v2","k3":"v3"},"expires":.+}}/);
    expect(cookie['key1']['expires']).toBeLessThan(cookie['key2']['expires']);
    expect(getCookie(key)).toEqual(val);

    document.cookie = undefined;
    key = 'key2';
    val = {k1:{k11:'v11',k12:'v12'},k2:'v2',k3:'v3'};
    expect(JSON.stringify(addCookie(key,val))).toMatch(/{"key2":{"value":{"k1":{"k11":"v11","k12":"v12"},"k2":"v2","k3":"v3"},"expires":.+}/);
    expect(getCookie(key)).toEqual(val);
    
    document.cookie = undefined;
    key = {};
    val = {k1:'v1',k2:'v2'};
    expect(JSON.stringify(addCookie(key,val))).toMatch(/{"\[object Object]":{"value":{"k1":"v1","k2":"v2"},"expires":.+}}/);
    expect(getCookie(key)).toEqual(val);

    document.cookie = undefined;
    key = 'key1';
    val = 'val1';
    expect(JSON.stringify(addCookie(key,val))).toMatch(/{"key1":{"value":"val1","expires":.+}}/);
    expect(getCookie(key)).toEqual(val);
    
    key = 'key2';
    val = ['val1','val2'];
    expect(JSON.stringify(addCookie(key,val))).toMatch(/{"key1":{"value":"val1","expires":.+},"key2":{"value":\["val1","val2"],"expires":.+}}/);
    expect(getCookie(key)).toEqual(val);
    
    // test invalid

    expect(getCookie('key3')).toBeUndefined();
});

test('cluster',() => {
    let num = v => {
        if (v) return v.commits + v.issues + v.pullRequests;
    };//todo name

    // test undefined/null/empty

    expect(cluster()).toEqual([{},{},{}]);
    expect(cluster(undefined,num)).toEqual([{},{},{}]);
    expect(cluster(null,num)).toEqual([{},{},{}]);
    expect(cluster({},num)).toEqual([{},{},{}]);

    let data = {};
    let val1 = 3;
    data['key1']=val1;
    expect(cluster(data)).toEqual([{},{key1:val1},{}]);

    val1 = {a:1,b:2,c:3};
    data['key1']=val1;
    expect(cluster(data)).toEqual([{},{},{}]);

    expect(cluster(data,null)).toBeNull();
    expect(cluster(data,()=>undefined)).toEqual([{},{},{}]);

    // test std

    val1 = {commits:1,issues:2,pullRequests:3};
    data['key1']=val1;
    expect(cluster(data,num)).toEqual([{},{key1:val1},{}]);

    let val2 = {commits:0,issues:0,pullRequests:1};
    data['key2']=val2;
    expect(cluster(data,num)).toEqual([{},{key1:val1},{key2:val2}]);

    let val3 = {commits:3,issues:4,pullRequests:-1};
    data['key3']=val3;
    expect(cluster(data,num)).toEqual([{},{key1:val1,key3:val3},{key2:val2}]);

    data = {};
    val1 = {a:'v1',b:1,c:'v2'};
    data['key1']=val1;
    expect(cluster(data, v=>v.b)).toEqual([{},{},{key1:val1}])

    data = {};
    val1 = {commits:10,issues:10,pullRequests:10};
    data['key1']=val1;
    expect(cluster(data,num)).toEqual([{key1:val1},{},{}]);

    // test invalid

    data['key2']=undefined;
    expect(cluster(data,num)).toEqual([{key1:val1},{},{}]);

    data['key2']={commits:1};
    expect(cluster(data,num)).toEqual([{key1:val1},{},{}]);
});

test('max', () => {

    // test undefined/null/empty
    expect(max()).toBe(-Infinity);
    expect(max(undefined)).toBe(-Infinity);
    expect(max(null)).toBe(-Infinity);
    expect(max({})).toBe(-Infinity);
    expect(max([])).toBe(-Infinity);
    expect(max(new Map())).toBe(-Infinity);

    // test std
    expect(max({a:2})).toBe(2);
    expect(max({a:1,b:3,c:2})).toBe(3);
    expect(max({a:{a:1,b:3,c:2},b:{a:5,b:1,c:2}})).toBe(5);
    expect(max([{a:-1,b:-3,c:-2},{a:-5,b:-1,c:-2}])).toBe(-1);
    expect(max([{a:1,b:true,c:{}},{a:5,b:'str',c:2}])).toBe(5);

    // test invalid input todo are there any?
});

//todo
test('getToken', () => {
    let d = new Date();

    // test undefined/null/empty
    document.cookie = undefined;
    expect(getToken()).toBeUndefined();
    document.cookie = `{"token":{"value":"","expires":${d.getTime()}}}`;
    expect(getToken()).toBeUndefined();

    // test std
    document.cookie=undefined;
    document.cookie = JSON.stringify({token:{value:"myToken",expires:d.getTime() + EXPIRY_TIME}});
    document.getElementById('token').value = '';//todo need to load window first...
    expect(getToken()).toBe("myToken");
    // test invalid
});