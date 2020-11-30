//todo exception handling

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
    const repo = document.getElementById('repoIssues').value;
    const token = document.getElementById('tokenIssues').value;
    if (repo === '' || token === '') {
        alert("repo/token not entered")
        return false;
    }

    let url = 'https://api.github.com/repos/' + repo + '/issues?state=closed';
    const out = forEachPage(url, token, (jsonPage,out)=>{
        if (out === undefined) out = new Map();
        for (let i = 0; i < jsonPage.length; i++) {
            const num = jsonPage[i]['number'];
            let url = 'https://api.github.com/repos/' + repo + '/issues/' + num + '/events';
            console.log("Pinging issue " + num);
            let jsonEvent = sendHTTPRequest('GET',url, token);

            const author = jsonEvent[0]['actor']['login'];//todo might have multiple events; want to find event:closed
            if (!out.has(author)) out.set(author, 1);
            else out.set(author, out.get(author) + 1);
        }
        return out;
    });

    out.forEach((value, key)=>
        document.write('author: ' + key + ', nIssuesResolved: ' + value + '<br>'));
    return true;
}

//--todo--

function sendHTTPRequest(type, url, token) {
    const request = new XMLHttpRequest();
    request.open(type, url, false);
    request.setRequestHeader('Authorization', 'token ' + token);
    //todo optional parameters
    request.send();
    return JSON.parse(request.responseText);
}

/** todo name;description
 * Queries the GitHub API at the given url with the given token,
 * and performs the function f on this data.
 * This query will return data across multiple pages, so these
 * are looped through and f is performed for each.
 * The output 'out' is a user-defined data type,
 * and its use in f should be instantiated it if it hasn't already been,
 * otherwise add to the existing 'out' .
 * f is of the form out = f(page, out).
 * @param url url to query GitHub API with
 * @param token GitHub token for query
 * @param f function to be performed on data returned from the query
 * @returns user-defined data
 */
function forEachPage(url, token, f) {
    let cont = true;
    let out;
    const request = new XMLHttpRequest();
    for (let i = 1; cont && i < MAX_PAGES; i++) {
        console.log("Pinging page " + i);
        let page = sendHTTPRequest('GET', url, token);

        out = f(page, out);

        let header = request.getResponseHeader("link");
        url = getNextPage(header);
        if (!url) cont = false;
    }
    return out;
}

function getNextPage(header) {
    if (header) {
        let next = header.split('>; rel="next"');
        if (next === -1) return null; // if no next page
        return next[0].split("<")[1];
    }
    return null;
}

