let pollingInterval = null;
let lastState = false;          
let sessionStartTime = null;    


const ESP32_IP = '10.222.125.162';   
const HOURLY_RATE = 15;

async function fetchHardwareOccupancy() {
  try {
    const response = await fetch(`http://${ESP32_IP}/status`, { method: 'GET' });
    const text = await response.text();
    return text.trim() === '1';
  } catch (error) {
    return null; 
  }
}

async function handleHardwareTransition(currentOccupancyState, updateAppUIStateCallback) {
  const previousState = lastState;

  if (currentOccupancyState && !previousState) {
  
    sessionStartTime = new Date();
    
    if (updateAppUIStateCallback) {
      updateAppUIStateCallback({
        status: 'active',
        entryTime: sessionStartTime.toLocaleTimeString(),
        elapsedSeconds: 0,
        currentFee: 0
      });
    }
    console.log("[LOCAL SESSION] Car detected on D23/D22. Session starting!");

  } else if (!currentOccupancyState && previousState) {
    
    if (!sessionStartTime) return;

    const sessionEndTime = new Date();
    const timeDifferenceMilliseconds = sessionEndTime - sessionStartTime;
    
    const totalSeconds = Math.floor(timeDifferenceMilliseconds / 1000);
    const totalHours = totalSeconds / 3600;
    const computedFee = parseFloat((totalHours * HOURLY_RATE).toFixed(4)); 

    if (updateAppUIStateCallback) {
      updateAppUIStateCallback({
        status: 'completed',
        entryTime: sessionStartTime.toLocaleTimeString(),
        exitTime: sessionEndTime.toLocaleTimeString(),
        durationSeconds: totalSeconds,
        totalFee: computedFee > 0 ? computedFee : 0.05 
      });
    }
    
    console.log(`[LOCAL SESSION] Car left. Duration: ${totalSeconds}s. Fee: ${computedFee} ETB`);
    sessionStartTime = null; 

  } else if (currentOccupancyState && previousState && sessionStartTime) {
    
    const currentTime = new Date();
    const activeSeconds = Math.floor((currentTime - sessionStartTime) / 1000);
    const rollingHours = activeSeconds / 3600;
    const runningFee = parseFloat((rollingHours * HOURLY_RATE).toFixed(4));

    if (updateAppUIStateCallback) {
      updateAppUIStateCallback({
        status: 'active',
        entryTime: sessionStartTime.toLocaleTimeString(),
        elapsedSeconds: activeSeconds,
        currentFee: runningFee
      });
    }
  }

  lastState = currentOccupancyState;
}

export function startSensorMonitoring(updateUIComponentLayoutCallback) {
  if (pollingInterval) clearInterval(pollingInterval);
  
  pollingInterval = setInterval(async () => {
    const isOccupied = await fetchHardwareOccupancy();
    if (isOccupied !== null) {
      handleHardwareTransition(isOccupied, updateUIComponentLayoutCallback);
    }
  }, 1000); 
}

export function stopSensorMonitoring() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}
