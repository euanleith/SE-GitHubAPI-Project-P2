// todo json parsing error handling
//todo request error
// -invalid token
// -invalid repo
// -other
//todo misc bugs
// -fcitx/fcitx5 some data doesn't have authors
// -GerardColman/DieRoller commits (and probably issues&prs) can be null
// -web-flow?

const MAX_PAGES = 10; //todo
const EXPIRY_TIME = 120000; // 2 minutes

async function getNCommitsByAuthor(repo, token, data) {
    console.log('getting n commits by author');
    let url = 'https://api.github.com/repos/' + repo + '/commits';
    let promises = await queryEachPage(url, token);
    for (const promise of promises) {
        let text = promise.value;
        for (let i = 0; i < text.length; i++) {
            const author = text[i]['committer']['login'];
            if (!data[author]) data[author] = {commits:1};
            else if (!data[author].commits) data[author].commits=1;
            else data[author].commits++;
        }
    }
    return data;
}

//todo
// issues data is comprised of a list of pages of issues,
// each of which has a list of pages of events
async function getNIssuesResolvedByAuthor(repo, token, data) {
    console.log('getting n issues resolved by author');
    let url = 'https://api.github.com/repos/' + repo + '/issues?state=closed';

    // query each issue page, waiting for all to respond
    let promises = await queryEachPage(url, token);

    // then for each issue page, query their event pages
    let promisesPages = [];
    for (const promise of promises) {
        let text = promise.value;
        for (let i = 0; i < text.length; i++) {
            const num = text[i]['number'];
            console.log("pinging issue events " + num);
            let url = 'https://api.github.com/repos/' + repo + '/issues/' + num + '/events';
            promisesPages.push(queryEachPage(url, token));
        }
    }

    // wait for each list of event pages to respond
    await Promise.allSettled(promisesPages).then(promiseEventsPages => {

        // then for each list of event pages, find the user who closed the issue
        for (const promisesEventsPage of promiseEventsPages) {
            const promiseEvents = promisesEventsPage.value;
            for (const promiseEvent of promiseEvents) {
                let events = promiseEvent.value;
                const closedEvent = events.find(e => e['event'] === "closed");//todo case where can't find it
                const actor = closedEvent['actor'];
                let author;
                if (actor === null) author = "null";
                else author = actor['login'];
                if (!data[author]) data[author] = {issues:1};
                else if (!data[author].issues) data[author].issues=1;
                else data[author].issues++;
            }
        }
    });
    return data;
}

//todo
// pull request data is comprised of a list of pages of pull requests,
// each of which has a list of pages of reviews
async function getNPullRequestsReviewedByAuthor(repo, token, data) {
    console.log('getting n pull requests reviewed by author');
    let url = 'https://api.github.com/repos/' + repo + '/pulls?state=closed';

    // query each pull request page, waiting for all to respond
    let promises = await queryEachPage(url, token);

    // then for each pull request page, query their review pages
    let promisesPages = [];
    for (const promise of promises) {
        let text = promise.value;
        for (let i = 0; i < text.length; i++) {
            const num = text[i]['number'];
            console.log("pinging pull request reviews " + num);
            let url = 'https://api.github.com/repos/' + repo + '/pulls/' + num + '/reviews';
            promisesPages.push(queryEachPage(url, token));
        }
    }

    // wait for each list of review pages to respond
    await Promise.allSettled(promisesPages).then(promiseReviewsPages => {

        // then for each list of review pages, for each review, find their author
        for (const promiseReviewPage of promiseReviewsPages) {
            const promiseReviews = promiseReviewPage.value;
            for (const promiseReview of promiseReviews) {
                const reviews = promiseReview.value;
                for (const review of reviews) {
                    let author = review['user']['login'];
                    if (!data[author]) data[author] = {pullRequests:1};
                    else if (!data[author].pullRequests) data[author].pullRequests=1;
                    else data[author].pullRequests++;
                }
            }
        }
    });
    return data;
}

/**
 * Pings each page of a GitHub API query
 * @param url url to query GitHub API
 * @param token GitHub token for query
 * @return array of query promises to be acted on
 */
async function queryEachPage(url, token) {
    if (!url.includes("?")) url = url.concat("?per_page=50");
    else url = url.concat("&per_page=50");

    let header = await fetch(url, {
        method: 'GET',
        headers: {
            Authorization: 'token ' + token
        }
    }).then(result=>result.headers.get('link'));
    const nPages = getNPages(header);

    let promises = [];
    let i;
    for (i = 1; i <= nPages; i++) {
        console.log("pinging page " + i);
        let pageUrl = url + "&page=" + i;
        promises.push(fetch(pageUrl, {
            method: 'GET',
            headers: {
                Authorization: 'token ' + token
            }
        }).then(result=>{
            console.log('got response');//todo
            return result.json()
        }));
    }
    return Promise.allSettled(promises);
}

function getNPages(header) {
    if (header) {
        if (!header.includes('rel="last"')) return null;
        const map = parseHeader(header);
        if (!map) return null;
        const url = map.get('last')
        return parseInt(url.split('&page=')[1]);
    }
    return 1;
}

//todo name parseLinkHeader
function parseHeader(header) {
    try {
        if (!header) return null;
        let pages = header.split(', ');
        let pageMap = new Map();
        for (let page of pages) {
            let pair = page.split("; ");
            if (pair.length === 1) return null;
            let url = pair[0].split('<')[1].split('>')[0];
            let key = pair[1].split('rel="')[1].split('"')[0];
            pageMap.set(key, url);
        }
        return pageMap;
    } catch (e) {return null}
}

module.exports.parseHeader = parseHeader;//todo
module.exports.getNPages = getNPages;
module.exports.addCookie = addCookie;
module.exports.getCookie = getCookie;
module.exports.cluster = cluster;
module.exports.max = max;

function chart() {
    //todo wrap these in a function?
    const repo = document.getElementById('repo').value;
    if (repo === '') {
        alert("repo not entered")
        return false;
    }

    const tokenCookie = getCookie('token');
    let token = document.getElementById('token').value;
    if (token !== '') {
        document.cookie = undefined; // clear cookies
        addCookie('token',{value:token});
    } else {
        if (tokenCookie) {
            token = tokenCookie.value;
        } else {
            alert('token expired/not entered');
            return false;
        }
    }

    document.getElementById('repo').value = '';
    document.getElementById('token').value = '';
    document.getElementById("loader").style.visibility="visible";

    getData(repo, token).then((data)=> {
        console.log("done");
        const clusters = cluster(data, v=>{
            if (v) return v.commits+v.issues+v.pullRequests
        });
        display(clusters);
        document.getElementById("loader").style.visibility = "hidden";
        document.getElementById('oauthButton').style.display='block';
        document.getElementById('oauthText').style.display='none';
        document.getElementById('token').style.display='none';
    });
}

async function getData(repo, token) {
    console.log(document.cookie);
    const repoCookie = getCookie(repo);
    if (repoCookie) return repoCookie;

    let data = {}; // data is accumulated by each get function
    data = await getNCommitsByAuthor(repo, token, data);
    data = await getNIssuesResolvedByAuthor(repo, token, data);
    data = await getNPullRequestsReviewedByAuthor(repo, token, data);
    for (const k in data) {
        const v = data[k];
        if (!v.commits) v.commits=0;
        if (!v.issues) v.issues=0;
        if (!v.pullRequests) v.pullRequests=0;
    }
    //todo order; also then can cluster more efficiently maybe
    addCookie(repo, data);
    return data;
}

function addCookie(key, value) {
    if (!key || !value) {
        console.log('appending cookie failed');
        return null;
    }
    let cookie = {};
    if (document.cookie && document.cookie !== 'undefined')
        cookie = JSON.parse(document.cookie);
    console.log('appending cookie from - to -');
    console.log(cookie);

    let temp = {value:JSON.parse(JSON.stringify(value))};
    let d = new Date();
    temp.expires = d.getTime() + EXPIRY_TIME;
    //todo delete all expired cookies at some point?

    cookie[key] = temp; // insert or replace
    document.cookie = JSON.stringify(cookie);
    console.log(cookie);
    return cookie;
}

function getCookie(key) {
    try {
        const cookie = JSON.parse(document.cookie);
        if (cookie.hasOwnProperty(key)) {
            console.log('found cookie for ' + key);
            let d = new Date();
            if (d.getTime() > cookie[key].expires) {
                console.log('expired');
                return undefined;
            }
            console.log(cookie);
            return cookie[key].value;
        }
        return undefined;
    } catch (e) {return undefined;}
}

// todo assumes data already normalised (contains only commits, issues, and pullRequests)
// todo note some error handling will have to be done in f
function cluster(data, f=v=>v) {//todo name f
    if (!f) return null;
    let bin1 = 3, bin2 = 10; //todo make variable?
    let clusters = [{},{},{}];
    for (const k in data) {
        if (!data.hasOwnProperty(k)) continue;
        const v = data[k];
        const val = f(v);
        if (!val) continue;
        if (val < bin1) clusters[2][k]=v;
        else if (val < bin2) clusters[1][k]=v;
        else if (val > bin2) clusters[0][k]=v;
    }
    return clusters;
}

function avg(author) {
    return author.commits + author.issues + author.pullRequests / 3;
}

//todo returns the max number value in an object and its children objects
function max(obj) {
    let m = -Infinity;
    if (obj) {
        for (const k in obj) {
            if (obj.hasOwnProperty(k)) {
                const v = obj[k];
                if (typeof v === 'number') {
                    m = Math.max(m, v);
                } else if (typeof v === 'object' && v !== null) {
                    m = Math.max(m, max(v));
                }
            }
        }
    }
    return m;
}

//todo ' (' + (data.get(d).type/avg(data.get(d))*100).toFixed()+'%)'
function display(data) {
    const dataTypes = ['','Author','No. commits','No. issues resolved',' No. pull requests reviewed'];
    const titles = ['Cluster 1','Cluster 2','Cluster 3'];
    const maxInput = max(data);
    console.log(maxInput);

    const width = 190;
    const height = 20;
    const margin = 5;
    const xScale = d3.scaleLinear()
        .domain([0, maxInput])
        .range([0, width-margin]);

    d3.select("#data-type-column")
        .selectAll("p")
        .data(dataTypes)
        .enter()
        .append("p")
        .style("width", () => `${width - (2 * margin)}px`)
        .style("margin", () => `${margin}px`)
        .style("height", () => `${height}px`)
        .classed("data-type-text", true)
        .text(d => d);

    for (let i = 0; i < data.length; i++) {

        // delete old bar column
        d3.select('#row'+i)
            .remove();

        const authors = Object.keys(data[i]);

        if (authors.length === 0) continue;

        d3.select('body')
            .append('p');

        const rows = d3.select('body')
            .append('div')
            .attr("id",'row'+i)
            .classed('row',true);

        rows.append('p')
            .text(() => titles[i])
            .style("width", () => `${width}px`)

        // authors column
        rows.append("div")
            .selectAll("p")
            .data(authors)
            .enter()
            .append("p")
            .style("width", () => `${width - (2 * margin)}px`)
            .style("margin", () => `${margin}px`)
            .style("height", () => `${height}px`)
            .classed("author-text", true)
            .text(d => d);

        appendBarColumn(rows, width, margin, authors, xScale, d=>data[i][d].commits);
        appendBarColumn(rows, width, margin, authors, xScale, d=>data[i][d].issues);
        appendBarColumn(rows, width, margin, authors, xScale, d=>data[i][d].pullRequests);
    }
}

//todo name f; data? idk
function appendBarColumn(rows, width, margin, authors, xScale, f) {
    rows.append('div')
        .style("width", () => `${width}px`)
        .selectAll("div")
        .data(authors)
        .enter()
        .append("div")
        .style("width", () => `${width - margin}px`)
        .style("margin", () => `${margin}px`)
        .classed("background", true)
        .append("div")
        .style("width", d => `${xScale(f(d))}px`)
        .classed("pull-request-bar", true)
        .append("p")
        .style("margin-left", () => `${margin}px`)
        .text(d => f(d))
        .classed("label", true);
}

function newOAuth() {
    document.getElementById('oauthButton').style.display='none'
    document.getElementById('oauthText').style.display='inline'
    document.getElementById('token').style.display='inline'
}