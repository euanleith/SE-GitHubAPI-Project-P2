//todo json parsing error handling

const MAX_PAGES = 10; //todo
const EXPIRY_TIME = 60000; // 1 minute

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

function chart() {
    const repo = document.getElementById('repo').value;
    const token = document.getElementById('token').value;
    if (repo === '' || token === '') {
        alert("repo/token not entered")
        return false;
    }

    document.getElementById("loader").style.visibility="visible";

    getData(repo, token).then((data)=> {
        console.log("done");
        document.getElementById("loader").style.visibility = "hidden";
        const clusters = clusterData(data);
        display(clusters);
    });
}

async function getData(repo, token) {
    console.log(document.cookie);
    const repoCookie = getCookie(repo);
    if (repoCookie) {
        return repoCookie
    }
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
    appendCookie(repo, data);
    return data;
}

function appendCookie(key, value) {
    let cookie = {};
    if (document.cookie)
        cookie = JSON.parse(document.cookie);
    console.log('appending cookie from - to -');
    console.log(cookie);

    let temp = JSON.parse(JSON.stringify(value)); // copy of value
    let d = new Date();
    temp.expires = d.getTime() + EXPIRY_TIME; //todo delete all expired cookies at some point?

    console.log(cookie[key]);
    cookie[key] = temp; // todo insert or replace new cookie
    console.log(cookie[key]);
    document.cookie = JSON.stringify(cookie);
    console.log(cookie);
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
            let temp = JSON.parse(JSON.stringify(cookie[key])); // copy of cookie[key]
            delete temp.expires;
            return temp;
        }
        return undefined;
    } catch (e) {return undefined;}
}

function clusterData(data) {
    let bin1 = 3, bin2 = 10; //todo make variable?
    let clusters = [{},{},{}];
    for (const k in data) {
        const v = data[k];
        const sum = v.commits + v.issues + v.pullRequests;
        if (sum < bin1) clusters[2][k]=v;
        else if (sum < bin2) clusters[1][k]=v;
        else clusters[0][k]=v;
    }
    return clusters;
}

function avg(author) {
    return author.commits + author.issues + author.pullRequests / 3;
}

function max(data) {
    let max = 0;
    if (data) {
        for (const obj of data) {
            for (const k in obj) {
                const v = obj[k];
                max = Math.max(max, v.commits);
                max = Math.max(max, v.issues);
                max = Math.max(max, v.pullRequests);
            }
        }
    }
    return max;
}

//todo ' (' + (data.get(d).type/avg(data.get(d))*100).toFixed()+'%)'
function display(data) {
    const dataTypes = ['','Author','No. commits','No. issues resolved',' No. pull requests reviewed'];
    const titles = ['Cluster 1','Cluster 2','Cluster 3'];
    const maxInput = max(data);

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

        const authors = Object.keys(data[i]);

        if (authors.length === 0) continue;

        d3.select('body')
            .append('p');

        const rows = d3.select('body')
            .append('div')
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