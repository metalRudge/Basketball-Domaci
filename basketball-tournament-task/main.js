const { match } = require('assert');
const { group } = require('console');
const exp = require('constants');
const fs = require('fs');
const groupArray = [];
const pots  = {
    D:[],
    E:[],
    F:[],
    G:[]
};

fs.readFile('groups.json','utf-8',(err,data)=> {
    if(err)
    {
        console.log("error reading file",err);
        return;
    }
    const jsonData = JSON.parse(data);
    
    for (let group in jsonData)
    {
        if(jsonData.hasOwnProperty(group)){
            groupArray[group] = jsonData[group].map(team=>(
                {
                    Team:team.Team,
                    FIBARanking:team.FIBARanking,
                    points:team.points || 0,
                    headToHeadResults:{},
                    pointDifferences: {}
                }));
        }
    }
    generateGroupMatches(groupArray);
    rankTeams();
    Object.keys(groupArray).forEach(group => displayMatches('group',group));
    generateRounds();
    
});

function displayMatches(stage,matches = []) 
{
    if(stage === 'group'){
        const teams = groupArray[matches];
        console.log(`Grupa : ${matches}`);
        console.log('Timovi:');
        teams.forEach(team => console.log(`- ${team.Team}: ${team.points} poena`));
        console.log('\n');
    }
    else 
    {
        console.log(`\n${stage}:`);
        matches.forEach(match => {
            console.log(`    ${match.teamA.Team} - ${match.teamB.Team} (${match.result.scoreA} : ${match.result.scoreB})`);
        });
    }
}    

function generateGroupMatches(groupArray) {
    Object.entries(groupArray).forEach(([group, teams]) => {
        teams.forEach((teamA, i) => {
            teams.slice(i + 1).forEach(teamB => {
                const result = monteCarloSimulate(teamA, teamB, 1000);
                // Make sure to store the result in the teams' head-to-head results
                /* console.log(`Simulating Match: ${teamA.Team} vs ${teamB.Team}`);
                console.log(`Simulated Result: ${teamA.Team} Score: ${result.avgScoreA}, ${teamB.Team} Score: ${result.avgScoreB}`); */
                
                if (result.winner || result.loser) {
                    updatePoints(result.winner, result.loser, result.avgScoreA, result.avgScoreB);
                }
            });
        });
    });
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
const hasPlayedBefore = (teamA, teamB) => {
    return teamA.headToHeadResults && teamA.headToHeadResults[teamB.Team];
};
function generateKnockoutPhase(topTeams) {
    /* console.log('Generating Knockout Phase with Top Teams:', topTeams); */

    // Initialize pots
    pots.D = [];
    pots.E = [];
    pots.F = [];
    pots.G = [];

    // Populate pots based on rankings
    topTeams.forEach(team => {
        if (team.ranking <= 2) pots.D.push(team);
        else if (team.ranking <= 4) pots.E.push(team);
        else if (team.ranking <= 6) pots.F.push(team);
        else pots.G.push(team);
    });

    displayPots();

    // Function to find a suitable opponent and ensure valid matchups
    const findAndMatchOpponents = (potA, potB) => {
        const matchups = [];

        // Function to find the first suitable opponent
        const findSuitableOpponent = (team, opponents) => {
/*             console.log(`Finding suitable opponent for ${team.Team}`);
            console.log('Available opponents:', opponents.map(op => op.Team)); */

            for (let i = 0; i < opponents.length; i++) {
                const opponent = opponents[i];

                if (!opponent) {
                    console.warn(`Opponent at index ${i} is undefined.`);
                    continue;
                }

                

                if (!hasPlayedBefore(team, opponent)) {
                    /* console.log(`Suitable opponent found: ${opponent.Team}`); */
                    // Remove the opponent from the list and return it
                    return opponents.splice(i, 1)[0]; // Remove and return the opponent
                }
            }

            console.warn(`No suitable opponent found for ${team.Team}`);
            return null; // No suitable opponent found
        };

        // Match teams from Pot A with suitable opponents from Pot B
        while (potA.length > 0 && potB.length > 0) {
            const teamA = potA.shift(); // Take the first team from Pot A
            const teamB = findSuitableOpponent(teamA, potB);
            if (teamB) {
                matchups.push({ teamA, teamB });
            } else {
                // If no opponent is found, put the team back in the pot for further processing
                potA.push(teamA);
                console.warn(`Re-adding ${teamA.Team} to Pot A as no suitable opponent was found.`);
                break; // Break to avoid infinite loop
            }
        }

        // Match remaining teams
        while (potA.length > 0 && potB.length > 0) {
            const teamA = potA.shift();
            const teamB = potB.shift();
            matchups.push({ teamA, teamB });
        }

        return matchups;
    };

    // Match Pot D with Pot G
    const matchupsDG = findAndMatchOpponents(pots.D, pots.G);
    // Match Pot E with Pot F
    const matchupsEF = findAndMatchOpponents(pots.E, pots.F);

    // Process and simulate matchups
    const quarterFinals = [...matchupsDG, ...matchupsEF];
    let winners = [];
    let losers = [];
    const results = quarterFinals.map(match => {/* 
        console.log(`Simulating match between ${match.teamA.Team} and ${match.teamB.Team}`); */
        const result = generateKnockoutMatch(match.teamA,match.teamB);
        winners.push(result.winner);
        losers.push(result.loser);
        return {teamA:match.teamA,teamB:match.teamB,result};
    });
    const remainingTeams = winners.slice(0, 4);
    return { quarterFinals:results,remainingTeams,losers};
}

function generateRounds()
{
    
    const topTeams = rankTeams().filter(team => team.ranking <= 8);
    
    const knockoutResult = generateKnockoutPhase(topTeams);
    
    const { quarterFinals, remainingTeams,losers} = knockoutResult;
    
    displayMatches('Četvrtfinale',quarterFinals);

    // 2. Generate and display Semifinals
    const semiFinals = [];
    const winners = [];
    while (remainingTeams.length > 0) {
        const teamA = remainingTeams.shift();
        const teamB = remainingTeams.shift();
        const result = generateKnockoutMatch(teamA, teamB);
        semiFinals.push({ teamA, teamB, result });
        winners.push(result.winner);
        losers.push(result.loser);
    }
    
    displayMatches('Polufinale', semiFinals);
    let finalResult,thirdPlaceResult = {};
    if (winners.length === 2)
    {
        finalResult = generateKnockoutMatch(winners[0], winners[1]);

        // Display Final Match
        displayMatches('Finale', [{ teamA: winners[0], teamB: winners[1], result: finalResult }]);
        thirdPlaceResult = generateKnockoutMatch(losers[0], losers[1]);
        displayMatches('Utakmica za treće mesto', [{ teamA: losers[0], teamB: losers[1], result: thirdPlaceResult }]);
    }
    else 
    {
        console.error('Insufficient data for Third-Place Match');
    }
    
    console.log('\nMedalje:');
    console.log(`1. ${finalResult.winner.Team}`);
    console.log(`2. ${finalResult.loser.Team}`);
    console.log(`3. ${thirdPlaceResult.winner.Team}`);
}

function displayPots()
{
    console.log('Šeširi :\n');
    Object.keys(pots).forEach(pot => {
        console.log(`Pot ${pot}:`);
        pots[pot].forEach(team => {
            console.log(`- ${team.Team}`);
        });
    });
}


function generateKnockoutMatch(teamA,teamB){
    const result = monteCarloSimulate(teamA,teamB,100);
    return {
        winner:result.winner,
        loser:result.loser,
        scoreA:result.avgScoreA,
        scoreB:result.avgScoreB
    }
}

function updatePoints(winner,loser,scoreA,scoreB)
{
    if (typeof scoreA !== 'number' || isNaN(scoreA) || typeof scoreB !== 'number' || isNaN(scoreB))
    {
        console.error("Invalid scores passed to updatePoints:", scoreA, scoreB);
        return;
    }
    if(winner){
        winner.points +=2;
        
        winner.headToHeadResults[loser.Team] = {score:scoreA}
        winner.pointDifferences[loser.Team] = scoreA - scoreB;
    } 
    if(loser) {
        loser.points +=1;
        
        loser.headToHeadResults[winner.Team] = {score: scoreB};
        loser.pointDifferences[winner.Team] = scoreB - scoreA;
    }
}
function sortTeamByPoints(teams)
{
    teams.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (a.headToHeadResults[b.Team]) return a.headToHeadResults[b.Team].score - b.headToHeadResults[a.Team].score;
        if (b.headToHeadResults[a.Team]) return b.headToHeadResults[a.Team].score - a.headToHeadResults[b.Team].score;
        return comparePointsDifference(a, b);
    });
}
function rankTeams(){
    const topTeams =[];
    const secondTeams = [];
    const thirdTeams = [];

    Object.keys(groupArray).forEach(group => {
        const teams = groupArray[group];
        sortTeamByPoints(teams);
        topTeams.push(teams[0]);
        secondTeams.push(teams[1]);
        thirdTeams.push(teams[2]);
    });

    const assignRanks = (teams,startRank) => {
        return teams.map((team,index) => ({...team,ranking:startRank + index}));
    };
    
    const rankedTopTeams = assignRanks(topTeams,1);
    const rankedSecondTeams = assignRanks(secondTeams,4);
    const rankedThirdTeams = assignRanks(thirdTeams,7);
    const allRankedTeams = [...rankedTopTeams,...rankedSecondTeams,...rankedThirdTeams];
    return allRankedTeams;
}

function comparePointsDifference(teamA,teamB){

    const teamsInGroup = groupArray.find(group => group.includes(teamA));
    const relevantTeams = teamsInGroup.filter(team => team.points === teamA.points);

    if (relevantTeams.length === 3) {
        const diffA = relevantTeams.reduce((sum, team) => sum + (teamA.pointDifferences[team.Team] || 0), 0);
        const diffB = relevantTeams.reduce((sum, team) => sum + (teamB.pointDifferences[team.Team] || 0), 0);
        return diffB - diffA;
    }
    return 0;
}

function simulateMatch(rankA, rankB) {
    // Calculate the probability of Team A winning
    const probsA = 1 / (1 + Math.pow(10, (rankA - rankB) / 33));
    const minScore = 42;
    const maxScore = 138;
    const baseScoreA = minScore + (maxScore - minScore) * (probsA);
    const baseScoreB = minScore +  (maxScore - minScore)* (1-probsA);

    // Add randomness to the scores
    const randomnessFactor = 0.2; // Adjust this value to control the amount of randomness
    const scoreA = Math.round(baseScoreA + (Math.random() - 0.5) * randomnessFactor * (maxScore - minScore));
    const scoreB = Math.round(baseScoreB + (Math.random() - 0.5) * randomnessFactor * (maxScore - minScore));

    //console.log(`simulateMatch results: scoreA=${clampedScoreA}, scoreB=${clampedScoreB}`);
    return {
        scoreA: Math.max(minScore, Math.min(maxScore, scoreA)),
        scoreB: Math.max(minScore, Math.min(maxScore, scoreB))
    };
}




function monteCarloSimulate(teamA, teamB, simulations = 1000) {
    let totalScoreA = 0;
    let totalScoreB = 0;

    // Run simulations
    for (let i = 0; i < simulations; i++) {
        const result = simulateMatch(teamA.FIBARanking,teamB.FIBARanking);
        totalScoreA += result.scoreA;
        totalScoreB += result.scoreB;
    }

    // Calculate average scores
    const avgScoreA =Math.round(totalScoreA / simulations) ;
    const avgScoreB = Math.round(totalScoreB / simulations) ;
     // Determine the winner based on average scores
     let winner = null;
     let loser = null;
    if(avgScoreA > avgScoreB){
        winner = teamA;
        loser = teamB;
    }
    else if(avgScoreA < avgScoreB)
    {
        winner = teamB;
        loser = teamA;
    }
    else{
        console.log("no winner in this match!");
    }
    return {
        winner,
        loser,
        avgScoreA,
        avgScoreB
    };
}
