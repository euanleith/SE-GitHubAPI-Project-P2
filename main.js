//todo other json parsing error handling

const MAX_PAGES = 10; //todo

function getUserRepoInfo() {
    const username = document.getElementById('username').value;
    const repo = document.getElementById('repo').value;
    const token = document.getElementById('token').value;
    if (username === '' || token === '') {
        alert("user/token not entered")
        return false;
    }

    let url;
    if (repo === '')
        url = 'https://api.github.com/users/' + username; // get user
    else
        url = 'https://api.github.com/repos/' + username + '/' + repo; // get repo

    let json = sendHTTPRequest('GET',url,token);
    document.write(json);
    return true;
}

function getNCommitsByAuthor() {
    console.log('Getting n commits by author');
    const repo = document.getElementById('repoCommits').value;
    const token = document.getElementById('tokenCommits').value;
    if (repo === '' || token === '') {
        alert("repo/token not entered")
        return false;
    }

    let url = 'https://api.github.com/repos/' + repo + '/commits';
    let out = forEachPage(url, token, (jsonPage,out)=>{
        if (out === undefined) out = new Map();
        for (let i = 0; i < jsonPage.length; i++) {
            const author = jsonPage[i]['committer']['login'];
            if (!out.has(author)) out.set(author, 1);
            else out.set(author, out.get(author)+1);
        }
        return out;
    });

    out.forEach((value, key)=>
        document.write('author: ' + key + ', nCommits: ' + value + '<br>'));
    return true;
}

function getNIssuesResolvedByAuthor() {
    console.log('Getting n issues resolved by author');
    const repo = document.getElementById('repoIssues').value;
    const token = document.getElementById('tokenIssues').value;
    if (repo === '' || token === '') {
        alert("repo/token not entered")
        return false;
    }

    let url = 'https://api.github.com/repos/' + repo + '/issues?state=closed';
    const out = forEachPage(url, token, (jsonPage,out)=>{
        if (out === undefined) out = new Map();
        let request = new XMLHttpRequest();
        for (let i = 0; i < jsonPage.length; i++) {
            const num = jsonPage[i]['number'];
            console.log("Pinging issue " + num);
            let url = 'https://api.github.com/repos/' + repo + '/issues/' + num + '/events';
            let jsonEvent = sendHTTPRequest('GET',url, token,null,request);

            const closedEvent = jsonEvent.find(e=>e['event']==="closed");
            const actor = closedEvent['actor'];
            let author;
            if (actor === null) author = "null";
            else author = actor['login'];
            if (!out.has(author)) out.set(author, 1);
            else out.set(author, out.get(author) + 1);
        }
        return out;
    });

    out.forEach((value, key)=>
        document.write('author: ' + key + ', nIssuesResolved: ' + value + '<br>'));
    return true;
}

function sendHTTPRequest(type, url, token, body=undefined, request=undefined) {
    if (request === undefined) request = new XMLHttpRequest();
    request.open(type, url, false);
    request.setRequestHeader('Authorization', 'token ' + token);
    request.send(body);
    //todo exception handling
    return JSON.parse(request.responseText);
}

/**
 * Performs the function f for each page of a GitHub API query
 * The output 'out' is a user-defined data type,
 * which should be instantiated and added to by the user in f.
 * @param url url to query GitHub API
 * @param token GitHub token for query
 * @param f (page,out) function to be performed on data returned from the query
 * @returns user's data
 */
function forEachPage(url, token, f) {
    if (!url.includes("?")) url = url.concat("?per_page=50");
    else url = url.concat("&per_page=50");
    let cont = true;
    let out;
    const request = new XMLHttpRequest();
    for (let i = 1; cont && i < MAX_PAGES; i++) {
        console.log("Pinging page " + i);
        let page = sendHTTPRequest('GET',url,token,null,request);

        out = f(page, out);

        let header = request.getResponseHeader("link");
        url = getNextPage(header);
        if (!url) cont = false;
    }
    return out;
}

/**
 * Parses the header to get the url of the next page if it exists
 * @param header header of current page
 * @returns {string|null} url of next page if it exists, otherwise null
 */
function getNextPage(header) {
    if (header) {
        if (!header.includes('rel="next"')) return null;
        const map = parseHeader(header);
        return map.get('next');
    }
    return null;
}

function parseHeader(header) {
    let pages = header.split(', ');
    let pageMap = new Map();
    pages.forEach(page=>{
        let pair = page.split("; ");
        let url = pair[0].split('<')[1].split('>')[0];
        let key = pair[1].split('rel="')[1].split('"')[0];
        pageMap.set(key, url);
    });
    return pageMap;
}