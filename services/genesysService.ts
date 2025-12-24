
import { CustomerProfile, Agent } from '../types';

/**
 * Service to interact with Genesys Cloud API.
 * Handles OAuth Client Credentials and User Data Fetching with full pagination support.
 */
export const collectGenesysData = async (profile: CustomerProfile): Promise<Agent[]> => {
  // 0. Pre-flight Validation
  if (!profile.clientId?.trim() || !profile.clientSecret?.trim()) {
    throw new Error("Missing Credentials: Go to the 'Administration' tab and enter your Genesys Cloud Client ID and Secret.");
  }

  // Clean up hosts to ensure no double slashes or trailing slashes
  const cleanLoginHost = profile.loginHost.replace(/\/+$/, '');
  const cleanApiHost = profile.apiHost.replace(/\/+$/, '');
  const proxyPrefix = profile.corsProxy ? (profile.corsProxy.endsWith('/') ? profile.corsProxy : `${profile.corsProxy}`) : '';
  
  // 1. Obtain Access Token
  const authHeader = btoa(`${profile.clientId.trim()}:${profile.clientSecret.trim()}`);
  const tokenUrl = `${proxyPrefix}${cleanLoginHost}/oauth/token`;
  
  let access_token: string;

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: params.toString(),
      cache: 'no-store'
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      let detail = '';
      try {
        const errorJson = JSON.parse(errorText);
        detail = errorJson.error_description || errorJson.message || errorJson.error || errorText;
      } catch (e) {
        detail = errorText || `HTTP ${tokenResponse.status}`;
      }
      throw new Error(`Authentication failed: ${detail}`);
    }

    const tokenData = await tokenResponse.json();
    access_token = tokenData.access_token;
    
    if (!access_token) {
      throw new Error('Authentication failed: No access token received from server.');
    }
  } catch (error: any) {
    if (error.message === 'Failed to fetch') {
      throw new Error("Connection failed: The browser blocked the request (CORS) or the proxy is unreachable. Ensure your 'CORS Proxy' is correct and active.");
    }
    throw error;
  }

  // 2. Fetch Users with pagination
  let allUserEntities: any[] = [];
  let pageNumber = 1;
  let pageCount = 1;
  const pageSize = 100;

  try {
    do {
      // Added a timestamp cache-buster to ensure we get fresh data every time
      const timestamp = Date.now();
      const usersUrl = `${proxyPrefix}${cleanApiHost}/api/v2/users?pageSize=${pageSize}&pageNumber=${pageNumber}&expand=presence,routingStatus&_t=${timestamp}`;
      
      const usersResponse = await fetch(usersUrl, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });

      if (!usersResponse.ok) {
        const errorText = await usersResponse.text();
        throw new Error(`Failed to fetch user data (Page ${pageNumber}): ${usersResponse.status} - ${errorText}`);
      }

      const data = await usersResponse.json();
      if (data.entities) {
        allUserEntities = [...allUserEntities, ...data.entities];
      }
      
      pageCount = data.pageCount || 1;
      pageNumber++;
      
      // Safety break to prevent infinite loops in unexpected API behavior
      if (pageNumber > 100) break; 

    } while (pageNumber <= pageCount);

    const now = new Date();

    // 3. Transform Genesys User objects into our internal Agent interface
    const agents: Agent[] = allUserEntities.map((user: any) => {
      const routingStatus = user.routingStatus?.status || 'OFF_LINE';
      const startTime = user.routingStatus?.startTime 
        ? new Date(user.routingStatus.startTime) 
        : now;
      
      // Calculate idle time in minutes
      const idleMs = now.getTime() - startTime.getTime();
      const idleMinutes = routingStatus === 'IDLE' ? Math.max(0, Math.floor(idleMs / 60000)) : 0;

      // Map system presence
      const systemPresence = user.presence?.presenceDefinition?.systemPresence || 'Offline';
      
      // UI Efficiency Score heuristic
      let efficiencyScore = 100;
      if (routingStatus === 'IDLE') efficiencyScore = 40;
      if (routingStatus === 'NOT_RESPONDING') efficiencyScore = 10;
      if (routingStatus === 'COMMUNICATING') efficiencyScore = 95;

      return {
        id: user.id,
        name: user.name || 'Unknown Agent',
        presence: systemPresence,
        routingStatus: routingStatus as Agent['routingStatus'],
        idleMinutes: idleMinutes,
        lastStatusChange: user.routingStatus?.startTime || now.toISOString(),
        queue: user.department || 'General Floor',
        efficiencyScore: efficiencyScore
      };
    });

    return agents;
  } catch (error: any) {
    throw new Error(`Data fetch failed: ${error.message}`);
  }
};
