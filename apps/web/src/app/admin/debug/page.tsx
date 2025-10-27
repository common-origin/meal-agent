"use client";

import { useState } from "react";
import { Stack, Typography, Button } from "@common-origin/design-system";
import { 
  getEvents, 
  clearEvents, 
  isOptedOut, 
  setOptOut,
  getEventCountByType,
  getRecentEvents
} from "@/lib/analytics";
import type { AnalyticsEvent } from "@/lib/analytics";

export default function DebugPage() {
  const [events, setEvents] = useState<AnalyticsEvent[]>(getEvents());
  const [optOut, setOptOutState] = useState(isOptedOut());
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const refreshEvents = () => {
    setEvents(getEvents());
    setLastRefresh(new Date());
  };

  const handleClearEvents = () => {
    if (confirm("Clear all analytics events? This cannot be undone.")) {
      clearEvents();
      refreshEvents();
    }
  };

  const handleToggleOptOut = (checked: boolean) => {
    setOptOut(checked);
    setOptOutState(checked);
    refreshEvents();
  };

  const eventCounts = getEventCountByType();
  const recentEvents = getRecentEvents(7);

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
      <Stack direction="column" gap="xl">
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h1">Analytics Debug</Typography>
          <Button variant="secondary" onClick={refreshEvents}>
            🔄 Refresh
          </Button>
        </Stack>

        {/* Opt-out control */}
        <div style={{ 
          border: "1px solid #e9ecef", 
          borderRadius: "8px", 
          padding: "16px",
          backgroundColor: optOut ? "#fff3cd" : "white"
        }}>
          <Stack direction="row" alignItems="center" gap="md">
            <input
              type="checkbox"
              id="opt-out"
              checked={optOut}
              onChange={(e) => handleToggleOptOut(e.target.checked)}
              style={{ width: "20px", height: "20px", cursor: "pointer" }}
            />
            <label htmlFor="opt-out" style={{ cursor: "pointer", flex: 1 }}>
              <Typography variant="body">
                <strong>Opt out of analytics</strong> - When enabled, no events will be tracked
              </Typography>
            </label>
          </Stack>
        </div>

        {/* Summary stats */}
        <div style={{ 
          border: "1px solid #e9ecef", 
          borderRadius: "8px", 
          padding: "16px",
          backgroundColor: "white"
        }}>
          <Stack direction="column" gap="md">
            <Typography variant="h3">Summary</Typography>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div>
                <div style={{ color: "#6c757d" }}>
                  <Typography variant="caption">Total Events</Typography>
                </div>
                <Typography variant="h2">{events.length}</Typography>
              </div>
              <div>
                <div style={{ color: "#6c757d" }}>
                  <Typography variant="caption">Last 7 Days</Typography>
                </div>
                <Typography variant="h2">{recentEvents.length}</Typography>
              </div>
              {Object.entries(eventCounts).map(([type, count]) => (
                <div key={type}>
                  <div style={{ color: "#6c757d" }}>
                    <Typography variant="caption">{type}</Typography>
                  </div>
                  <Typography variant="h3">{count}</Typography>
                </div>
              ))}
            </div>
          </Stack>
        </div>

        {/* Event counts by type */}
        <div style={{ 
          border: "1px solid #e9ecef", 
          borderRadius: "8px", 
          padding: "16px",
          backgroundColor: "white"
        }}>
          <Stack direction="column" gap="md">
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h3">All Events ({events.length})</Typography>
              <Button 
                variant="secondary" 
                onClick={handleClearEvents}
                disabled={events.length === 0}
              >
                🗑️ Clear All Events
              </Button>
            </Stack>
            
            {events.length === 0 ? (
              <div style={{ color: "#6c757d", textAlign: "center", padding: "32px" }}>
                <Typography variant="body">
                  No events tracked yet. {optOut ? "Analytics is currently opted out." : "Use the app to generate events."}
                </Typography>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ 
                  width: "100%", 
                  borderCollapse: "collapse",
                  fontSize: "14px"
                }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #dee2e6", textAlign: "left" }}>
                      <th style={{ padding: "12px 8px" }}>Timestamp</th>
                      <th style={{ padding: "12px 8px" }}>Type</th>
                      <th style={{ padding: "12px 8px" }}>Metadata</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event, idx) => (
                      <tr 
                        key={idx} 
                        style={{ 
                          borderBottom: "1px solid #e9ecef",
                          backgroundColor: idx % 2 === 0 ? "#f8f9fa" : "white"
                        }}
                      >
                        <td style={{ padding: "12px 8px", whiteSpace: "nowrap" }}>
                          {new Date(event.timestamp).toLocaleString()}
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          <code style={{ 
                            backgroundColor: "#e9ecef", 
                            padding: "2px 6px", 
                            borderRadius: "4px",
                            fontSize: "12px"
                          }}>
                            {event.type}
                          </code>
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          <code style={{ fontSize: "12px", color: "#495057" }}>
                            {JSON.stringify(event.meta || {})}
                          </code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Stack>
        </div>

        {/* Metadata */}
        <div style={{ 
          padding: "16px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          color: "#6c757d"
        }}>
          <Typography variant="caption">
            Last refreshed: {lastRefresh.toLocaleTimeString()} • 
            localStorage key: ma_analytics • 
            Events stored locally only (never transmitted)
          </Typography>
        </div>
      </Stack>
    </div>
  );
}
