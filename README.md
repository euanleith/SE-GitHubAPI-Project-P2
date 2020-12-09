# SE-GitHubAPI-Project-P2

The goal of this project is to query the GitHub API to aid in answering the question 'how do hard-workers spend their time?'.

The degree of work is be calculated as the number of actions (commits, issues resolved, and pull requests reviewed) each user performs for each repo.
(This process could be extended in two ways. Firstly, by (somehow) calculating the relative weights of each action-type. And secondly by adding greater specificity to the group of actions. For example, 'commits' could be split into 'new code' and 'rewritten code' (i.e. code churn).)

The users are then split into three clusters which can be understood as 'hard workers', 'average workers', and 'light workers'.

## Details

### HTTP Requests

The GitHub API is queried with HTTP requests. In order to improve efficiency, chunks of requests are performed asynchronously before waiting for and processing the responses from the API.

### Cookies

Cookies were added to improve efficiency and usability. Each cookie contains data and an expiry time.

#### Repo cookies

In order to further improve efficiency, cookies were added for each repo the user queries. With these, processing can be skipped for recent queries.

#### OAuth token cookies

In order to remove the need to repeatedly input OAuth tokens, the inputted token is stored as a cookie. The token used can still be changed by clicking on the relevant button and inputting a new token. This will then replace the existing token cookie.

### UI

The displayed graph is made using the D3 library. It shows the proportions of each action for each user. This can be analysed to approximate how workers spend their time; but also to approximate the relative levels of work between workers, both overall and for each action.  

### Clustering

The data is clustered into three groups by magnitude. Each data type (number of commits; issues resolved; and pull requests reviewed) is considered as of equal weight. Therefore the magnitude is the sum of all data types. This is one-dimensional, so clustering can be easily performed by slotting each datum into bins based on this dimension.