import axios from "axios";

export const getMatchesFromApi = async (timestamp) => {
  const url = `https://app.nb-bet.com/v1/soccer/results/page?timestamp=${timestamp}`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error("Error fetching data from API:", error);
    return null;
  }
};

export const getOddsHistoryFromApi = async (matchId) => {
  const url = `https://app.nb-bet.com/v1/soccer/events/odds-history/${matchId}/false`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching odds history data from API for matchId ${matchId}:`, error);
    return null;
  }
};

export const getEventPageData = async (matchId) => {
  const url = `https://app.nb-bet.com/v1/soccer/events/page/${matchId}/50/12/true/false/true/false/true/true`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching event page data from API for matchId ${matchId}:`, error);
    return null;
  }
};

export const getSofascoreMatches = async (dateString) => {
  const url = `https://www.sofascore.com/api/v1/sport/football/scheduled-events/${dateString}`;
  try {
    const response = await axios.get(url);
    const events = response.data.events || [];
    const filteredEvents = events.filter(el => el.status.code === 0);
    const matches = filteredEvents.map(el => ({
      homeTeam: el.homeTeam.name,
      awayTeam: el.awayTeam.name,
      id: el.id,
    }));
    return matches;
  } catch (error) {
    console.error(`Error fetching Sofascore matches for date ${dateString}:`, error);
    return null;
  }
};

export const getSofascoreLineups = async (id) => {
  const url = `https://www.sofascore.com/api/v1/event/${id}/lineups`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching Sofascore lineups for event ID ${id}:`, error);
    return null;
  }
};

export const getStatshubEvents = async (startOfDayTimestamp, endOfDayTimestamp) => {
  const url = `https://www.statshub.com/api/event/by-date?startOfDay=${startOfDayTimestamp}&endOfDay=${endOfDayTimestamp}`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching Statshub events for range ${startOfDayTimestamp}-${endOfDayTimestamp}:`, error);
    return null;
  }
};


export const getTeamTournaments = async (teamId) => {
  const url = `https://www.statshub.com/api/team/${teamId}/tournaments-and-seasons`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching tournaments for team ${teamId}:`, error);
    return null;
  }
};

export const getStatshubTeamPerformance = async (teamId, tournamentId) => {
  const url = `https://www.statshub.com/api/team/${teamId}/performance?tournamentId=${tournamentId}&limit=20&location=all&eventHalf=ALL`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(`Error fetching Statshub team performance for team ${teamId} in tournament ${tournamentId}:`, error);
    return null;
  }
};

export const getStatshubPlayerPerformance = async (teamId, tournamentId, fixtureId) => {
  const url = `https://www.statshub.com/api/team/${teamId}/players/performance?tournamentId=${tournamentId}&limit=20&location=both&fixtureId=${fixtureId}`;
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
        console.error(`Error fetching Statshub player performance for team ${teamId}, fixture ${fixtureId}:`, error);
        return null;
      }
    };
    
    export const getSofascorePregameForm = async (id) => {
      const url = `https://www.sofascore.com/api/v1/event/${id}/pregame-form`;
      try {
        const response = await axios.get(url);
        return response.data;
      } catch (error) {
        console.error(`Error fetching Sofascore pregame form for event ID ${id}:`, error);
        return null;
      }
    };