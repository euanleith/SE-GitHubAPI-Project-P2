function getUserRepoInfo() {
    const username = document.getElementById('username').value;
    const repo = document.getElementById('repo').value;
    const token = document.getElementById('token').value;
    if (username === '' || token === '') {
        alert("user/token not entered")
        return false;
    }

    var url;
    if (repo === '')
        url = 'https://api.github.com/users/' + username; // get user
    else
        url = 'https://api.github.com/repos/' + username + '/' + repo; // get repo

    const request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.setRequestHeader('Authorization', 'token ' + token);
    request.send();
    document.write(request.responseText);
    return true;
}

function getNCommitsByAuthor() {
    const repo = document.getElementById('repoCommits').value;
    const token = document.getElementById('tokenCommits').value;
    if (repo === '' || token === '') {
        alert("repo/token not entered")
        return false;
    }

    const url = 'https://api.github.com/repos/' + repo + '/commits';
    const request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.setRequestHeader('Authorization', 'token ' + token);
    request.send();
    const json = JSON.parse(request.responseText);

    const out = new Map();
    for (let i = 0; i < json.length; i++) {
        const author = json[i]['commit']['author']['name'];
        if (!out.has(author)) out.set(author, 1);
        else out.set(author, out.get(author)+1);
    }

    out.forEach((value, key)=>
        document.write('author: ' + key + ', nCommits: ' + value + '\n'));
    return true;
}

function getNIssuesResolvedByAuthor() {
    const repo = document.getElementById('repoIssues').value;
    const token = document.getElementById('tokenIssues').value;
    if (repo === '' || token === '') {
        alert("repo/token not entered")
        return false;
    }

    // get issues
    let url = 'https://api.github.com/repos/' + repo + '/issues?state=closed';
    const request = new XMLHttpRequest();
    request.open('GET', url, false);
    request.setRequestHeader('Authorization', 'token ' + token);
    request.send();
    let json = JSON.parse(request.responseText);

    // for each issue, get user who closed it (from issue events)
    const out = new Map();
    const num = json[0]['number'] // todo get all pages; then for i < num
    for (let i = 0; i < 30; i++) {
        let url = 'https://api.github.com/repos/' + repo + '/issues/' + i + '/events';
        request.open('GET', url, false);
        request.setRequestHeader('Authorization', 'token ' + token);
        request.send();
        json = JSON.parse(request.responseText);
        for (let i = 0; i < json.length; i++) {
            const author = json[i]['actor']['login'];
            if (!out.has(author)) out.set(author, 1);
            else out.set(author, out.get(author) + 1);
        }
    }

    out.forEach((value, key)=>
        document.write('author: ' + key + ', nIssuesResolved: ' + value + '\n'));
    return true;
}