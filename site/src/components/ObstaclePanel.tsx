/**
 * ObstaclePanel.tsx
 * Real-time tactical obstacle tracking telemetry table and alert cards.
 * Displays persistent target IDs, spatial coordinates, approximate widths,
 * detection confidence, tracking status, and closest threat warnings.
 */

import React from 'react';
import { TrackedObstacle } from '../types/radar';

interface ObstaclePanelProps {
  obstacles: TrackedObstacle[];
  closestObstacle?: TrackedObstacle;
  onClearObstacles: () => void;
}

export const ObstaclePanel: React.FC<ObstaclePanelProps> = ({
  obstacles,
  closestObstacle,
  onClearObstacles,
}) => {
  const activeObstacles = obstacles.filter((o) => o.status !== 'LOST');
  const now = Date.now();

  return (
    <section className="panel-card obstacle-panel-card" aria-labelledby="obstacle-panel-title">
      <div className="card-header">
        <h2 id="obstacle-panel-title" className="card-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="22" y1="12" x2="18" y2="12" />
            <line x1="6" y1="12" x2="2" y2="12" />
            <line x1="12" y1="6" x2="12" y2="2" />
            <line x1="12" y1="22" x2="12" y2="18" />
          </svg>
          Tactical Obstacle Telemetry
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="telem-label">
            TARGETS: {activeObstacles.length} ACTIVE / {obstacles.length} TOTAL
          </span>
          <button
            className="quick-btn"
            style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
            onClick={onClearObstacles}
            title="Clear all tracked targets"
          >
            Clear Tracks
          </button>
        </div>
      </div>

      {/* Closest Target Threat Banner */}
      {closestObstacle ? (
        <div className={`obstacle-threat-banner ${closestObstacle.distance < 25 ? 'danger' : 'warning'}`}>
          <div className="threat-indicator-dot" />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>
                {closestObstacle.distance < 25 ? '⚠ COLLISION WARNING' : 'PROXIMITY ALERT'}: TARGET [{closestObstacle.id}]
              </strong>
              <span className="threat-distance">{closestObstacle.distance.toFixed(1)} cm</span>
            </div>
            <div style={{ fontSize: '0.75rem', opacity: 0.9, marginTop: '2px' }}>
              Bearing: {closestObstacle.angle.toFixed(1)}° &bull; Approx Width: ~{closestObstacle.approxWidthCm} cm &bull; Confidence: {closestObstacle.confidence}%
            </div>
          </div>
        </div>
      ) : (
        <div className="obstacle-threat-banner clear">
          <span style={{ fontSize: '0.85rem' }}>✓ Sector Clear: No persistent targets inside warning threshold.</span>
        </div>
      )}

      {/* Tracked Obstacles Data Table */}
      <div className="obstacle-table-wrap">
        <table className="obstacle-table" aria-label="Detected Obstacles List">
          <thead>
            <tr>
              <th>TARGET ID</th>
              <th>BEARING</th>
              <th>DISTANCE</th>
              <th>APPROX WIDTH*</th>
              <th>CONFIDENCE</th>
              <th>STATUS</th>
              <th>LAST SEEN</th>
            </tr>
          </thead>
          <tbody>
            {obstacles.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                  Awaiting sensor sweep echoes. Rotate scanner to map obstacles.
                </td>
              </tr>
            ) : (
              obstacles.map((obs) => {
                const ageSec = Math.max(0, Math.round((now - obs.lastSeen) / 1000));
                return (
                  <tr key={obs.id} className={obs.isClosest ? 'closest-row' : ''}>
                    <td>
                      <span className="target-id-badge">
                        {obs.isClosest && '★ '}
                        {obs.id}
                      </span>
                    </td>
                    <td>{obs.angle.toFixed(1)}°</td>
                    <td>
                      <strong>{obs.distance.toFixed(1)} cm</strong>
                    </td>
                    <td>
                      ~{obs.approxWidthCm} cm
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '3px' }}>
                        (&plusmn;15° beam)
                      </span>
                    </td>
                    <td>
                      <div className="confidence-meter-wrap">
                        <div
                          className="confidence-meter-fill"
                          style={{
                            width: `${obs.confidence}%`,
                            backgroundColor:
                              obs.confidence >= 80 ? '#10b981' : obs.confidence >= 50 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                        <span className="confidence-val">{obs.confidence}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-pill ${obs.status.toLowerCase()}`}>
                        {obs.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {ageSec === 0 ? 'Just now' : `${ageSec}s ago`}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="obstacle-disclaimer">
        * <em>Approximate width:</em> Computed from geometric arc span <code>2 &times; R &times; sin(&Delta;&theta;/2)</code> and boundary clustering. HC-SR04 wide acoustic cone (~15°) produces soft acoustic boundaries.
      </div>
    </section>
  );
};
