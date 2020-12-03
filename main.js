//todo json parsing error handling

const MAX_PAGES = 10; //todo

function getNCommitsByAuthor(repo, token) {
    console.log('getting n commits by author');
    let url = 'https://api.github.com/repos/' + repo + '/commits';
    return forEachPage(url, token, (jsonPage,out)=>{
        if (out === undefined) out = new Map();
        for (let i = 0; i < jsonPage.length; i++) {
            const author = jsonPage[i]['committer']['login'];
            if (!out.has(author)) out.set(author, 1);
            else out.set(author, out.get(author)+1);
        }
        return out;
    });
}

function getNIssuesResolvedByAuthor(repo, token) {
    console.log('getting n issues resolved by author');
    let url = 'https://api.github.com/repos/' + repo + '/issues?state=closed';
    return  forEachPage(url, token, (jsonPage,out)=>{
        if (out === undefined) out = new Map();//todo could put this before function?
        let request = new XMLHttpRequest();
        for (let i = 0; i < jsonPage.length; i++) {
            const num = jsonPage[i]['number'];
            console.log("pinging issue " + num);
            let url = 'https://api.github.com/repos/' + repo + '/issues/' + num + '/events';//todo might need to do this for each page?
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
}

function getNPullRequestsReviewedByAuthor(repo, token) {
    console.log('getting n pull requests reviewed by author');
    let url = 'https://api.github.com/repos/' + repo + '/pulls?state=closed';
    return forEachPage(url, token, (jsonPage,out)=> {
        if (out === undefined) out = new Map();
        let request = new XMLHttpRequest();
        for (let i = 0; i < jsonPage.length; i++) {
            const num = jsonPage[i]['number'];
            console.log("pinging pull request " + num);
            let url = 'https://api.github.com/repos/' + repo + '/pulls/' + num + '/reviews';//todo might need to do this for each page?
            let jsonReviews = sendHTTPRequest('GET', url, token, null, request);

            jsonReviews.forEach(review => {
                let author = review['user']['login'];
                if (!out.has(author)) out.set(author, 1);
                else out.set(author, out.get(author) + 1);
            });
        }
        return out;
    });
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
        console.log("pinging page " + i);
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

function chart() {
    const repo = document.getElementById('repo').value;
    const token = document.getElementById('token').value;
    if (repo === '' || token === '') {
        alert("repo/token not entered")
        return false;
    }

    document.getElementById("loader").style.visibility="visible";

    sleep(100).then(() => //todo remove?
        getData(repo, token).then(({commits, issues, pullRequests}) => {
            console.log("done");

            document.getElementById("loader").style.visibility="hidden";

            let keys = Object.keys(commits);
            keys.forEach(a=>document.write(a+' '+keys[a]));
            keys = Object.keys(issues);
            keys.forEach(a=>document.write(a+' '+keys[a]));
            keys = Object.keys(pullRequests);
            keys.forEach(a=>document.write(a+' '+keys[a]));
    }));
}

function sleep (time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

async function getData(repo, token) {
    const commits = getNCommitsByAuthor(repo, token);
    const issues = getNIssuesResolvedByAuthor(repo, token);
    const pullRequests = getNPullRequestsReviewedByAuthor(repo, token);
    return {'commits': commits, 'issues': issues, 'pullRequests': pullRequests};
}