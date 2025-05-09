import React, { useState, useEffect, useRef } from 'react';
import { Card, Alert, Spinner, Badge, ProgressBar, Button, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTrophy, faVoteYea, faCalendarAlt, faUsers, faPercentage, 
  faSync, faChartBar, faCheck, faMedal, faInfoCircle
} from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';

// Add CSS styles as a separate object - this replaces the style jsx tag
const styles = {
  electionResults: {
    transition: 'all var(--transition-speed)'
  },
  animateFadeIn: {
    animation: 'fadeIn 0.5s ease-in'
  },
  animateSlideUp: {
    animation: 'slideUp 0.5s ease-out forwards',
    opacity: 0
  },
  staggerItem: {
    opacity: 0
  },
  pulseAnimation: {
    animation: 'pulse 1.5s infinite'
  },
  pulseAnimationSlow: {
    animation: 'pulse 3s infinite'
  },
  hoverLift: {
    transition: 'transform var(--transition-speed), box-shadow var(--transition-speed)'
  },
  hoverLiftHover: {
    transform: 'translateY(-5px)',
    boxShadow: '0 10px 20px rgba(0, 0, 0, 0.1) !important'
  },
  winnerCard: {
    backgroundColor: 'var(--bg-primary-light)'
  },
  positionIndicator: {
    width: '26px',
    height: '26px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  positionIcon: {
    fontSize: '1.2rem'
  },
  goldIcon: {
    color: '#ffc107'
  },
  silverIcon: {
    color: '#adb5bd'
  },
  bronzeIcon: {
    color: '#cd7f32'
  },
  winnerIcon: {
    animation: 'shimmer 2s infinite'
  },
  textGradient: {
    background: 'linear-gradient(45deg, var(--primary-color), var(--secondary-color))',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    display: 'inline-block'
  },
  compactViewCard: {
    padding: '0.75rem !important',
    marginBottom: '0.5rem !important'
  },
  compactGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1rem'
  }
};

// Add the keyframe animations to the document - this will run once when the component is first mounted
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    
    @keyframes slideUp {
      from { 
        opacity: 0;
        transform: translateY(20px);
      }
      to { 
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.7; }
      100% { opacity: 1; }
    }
    
    @keyframes shimmer {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.8; transform: scale(1.1); }
      100% { opacity: 1; transform: scale(1); }
    }
  `;
  document.head.appendChild(styleElement);
}

const ElectionResults = ({ 
  electionId = null, 
  showHeader = true, 
  maxResults = null, 
  refreshInterval = 30000  // Default refresh every 30 seconds
}) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [animateResults, setAnimateResults] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'compact'
  const resultsRef = useRef(null);

  const fetchResults = React.useCallback(async (showRefreshAnimation = false) => {
    try {
      if (showRefreshAnimation) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const endpoint = electionId 
        ? `http://localhost:5000/api/vote/results/${electionId}` 
        : 'http://localhost:5000/api/vote/completed-results';
      
      const response = await axios.get(endpoint);
      
      if (electionId) {
        // Single election results
        setResults([response.data]);
      } else {
        // Multiple election results
        setResults(response.data.elections || []);
      }
      
      setLoading(false);
      setRefreshing(false);
      setLastUpdated(new Date());
      
      // Trigger animation after data is loaded
      setTimeout(() => setAnimateResults(true), 100);
    } catch (error) {
      console.error('Error fetching election results:', error);
      setError('Failed to load election results. Please try again later.');
      setLoading(false);
      setRefreshing(false);
    }
  }, [electionId]);

  const handleManualRefresh = () => {
    fetchResults(true);
  };

  useEffect(() => {
    fetchResults();
    
    // Set up periodic refresh if requested
    if (refreshInterval > 0) {
      const interval = setInterval(() => fetchResults(true), refreshInterval);
      return () => clearInterval(interval);
    }
  }, [electionId, refreshInterval, fetchResults]);

  // Filter results if maxResults is specified
  const displayResults = maxResults ? results.slice(0, maxResults) : results;

  if (loading) {
    return (
      <div className="text-center my-4 animate-fade-in">
        <div className="loading-container py-5">
          <Spinner animation="border" role="status" variant="primary" className="pulse-animation">
            <span className="visually-hidden">Loading results...</span>
          </Spinner>
          <p className="mt-3 text-primary">Loading election results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger" className="animate-fade-in shadow-sm">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <FontAwesomeIcon icon={faInfoCircle} className="me-2" />
            {error}
          </div>
          <Button variant="outline-danger" size="sm" onClick={handleManualRefresh}>
            <FontAwesomeIcon icon={faSync} className="me-1" />
            Retry
          </Button>
        </div>
      </Alert>
    );
  }

  if (displayResults.length === 0) {
    return (
      <Alert variant="info" className="animate-fade-in shadow-sm">
        <FontAwesomeIcon icon={faVoteYea} className="me-2" />
        No completed elections found. Results will be displayed here once elections are completed.
      </Alert>
    );
  }


  // Function to render position icon
  const getPositionIcon = (position) => {
    switch(position) {
      case 1: return <FontAwesomeIcon icon={faTrophy} className="position-icon gold-icon" />;
      case 2: return <FontAwesomeIcon icon={faMedal} className="position-icon silver-icon" />;
      case 3: return <FontAwesomeIcon icon={faMedal} className="position-icon bronze-icon" />;
      default: return position;
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'card' ? 'compact' : 'card');
    // Reset animations to trigger them again
    setAnimateResults(false);
    setTimeout(() => setAnimateResults(true), 50);
  };

  return (
    <div 
      className={`election-results ${animateResults ? 'animate-fade-in' : ''}`} 
      ref={resultsRef}
      style={styles.electionResults}
    >
      <div className="d-flex justify-content-between align-items-center mb-3">
        {showHeader && (
          <div className="d-flex align-items-center">
            <FontAwesomeIcon icon={faChartBar} className="me-2 text-primary" />
            <h3 className="mb-0" style={styles.textGradient}>Election Results</h3>
          </div>
        )}
        
        <div className="d-flex align-items-center">
          {lastUpdated && (
            <OverlayTrigger
              placement="top"
              overlay={
                <Tooltip>Last updated at {lastUpdated.toLocaleTimeString()}</Tooltip>
              }
            >
              <small className="text-muted me-3">
                {refreshing ? (
                  <span>
                    <Spinner animation="border" size="sm" className="me-1" />
                    Updating...
                  </span>
                ) : (
                  <span>
                    <FontAwesomeIcon icon={faCheck} className="text-success me-1" />
                    Updated
                  </span>
                )}
              </small>
            </OverlayTrigger>
          )}
          
          <div className="d-flex">
            <Button 
              variant="outline-primary" 
              size="sm" 
              className="me-2"
              onClick={handleManualRefresh}
              disabled={refreshing}
            >
              <FontAwesomeIcon 
                icon={faSync} 
                className={`me-1 ${refreshing ? 'fa-spin' : ''}`} 
              />
              Refresh
            </Button>
            
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={toggleViewMode}
            >
              <FontAwesomeIcon 
                icon={viewMode === 'card' ? faChartBar : faChartBar} 
                className="me-1" 
              />
              {viewMode === 'card' ? 'Compact View' : 'Card View'}
            </Button>
          </div>
        </div>
      </div>
      
      <div className={`results-container ${viewMode === 'compact' ? 'compact-view' : 'card-view'}`}>
        {displayResults.map((result, index) => (
          <Card 
            key={result.election.id || index} 
            className={`mb-4 border-0 card-modern ${viewMode === 'card' ? 'card-hover' : ''} shadow-sm stagger-item animate-slide-up`} 
            style={{
              animationDelay: `${index * 0.1}s`,
              ...(viewMode === 'card' ? styles.hoverLift : {})
            }}
          >
            <Card.Header className={`${viewMode === 'card' ? 'bg-white' : 'bg-light'} border-bottom-0 py-3`}>
              <h4 style={styles.textGradient}>{result.election.title}</h4>
              <div className="d-flex align-items-center mt-2 text-muted small">
                <FontAwesomeIcon icon={faCalendarAlt} className="me-2" size="sm" />
                <span>
                  {new Date(result.election.startTime || result.election.start_time).toLocaleDateString()} - {new Date(result.election.endTime || result.election.end_time).toLocaleDateString()}
                </span>
              </div>
            </Card.Header>
            
            <Card.Body className="pt-0">
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap">
                <Badge bg="primary" className="py-2 px-3 d-flex align-items-center shadow-sm">
                  <FontAwesomeIcon icon={faUsers} className="me-2" />
                  <span>Total Votes: <strong>{result.totalVotes}</strong></span>
                </Badge>
                
                {result.results && result.results.length > 0 && (
                  <Badge 
                    bg="success" 
                    className="py-2 px-3 d-flex align-items-center shadow-sm hover-lift pulse-animation-slow"
                    style={styles.pulseAnimationSlow}
                  >
                    <FontAwesomeIcon 
                      icon={faTrophy} 
                      className="me-2 winner-icon" 
                      style={styles.winnerIcon}
                    />
                    <span>
                      Winner: <strong>{result.results[0].candidate.name}</strong> 
                      {viewMode === 'card' && <span> ({result.results[0].candidate.party})</span>}
                    </span>
                  </Badge>
                )}
              </div>
              
              <div style={viewMode === 'compact' ? styles.compactGrid : {}}>
                {result.results && result.results.map((candidateResult, idx) => {
                  const votePercentage = result.totalVotes === 0 
                    ? 0 
                    : Math.round((candidateResult.votes / result.totalVotes) * 100);
                  
                  return (
                    <div 
                      key={candidateResult.candidate.id} 
                      className={`candidate-result-card p-3 mb-3 rounded ${idx === 0 ? 'winner-card' : ''} 
                        ${viewMode === 'card' ? 'hover-lift' : ''} stagger-item animate-slide-up`}
                      style={{
                        animationDelay: `${(index * 0.1) + (idx * 0.1) + 0.2}s`,
                        borderLeft: idx === 0 
                          ? '4px solid var(--success-color)' 
                          : idx === 1 
                            ? '4px solid var(--primary-color)' 
                            : idx === 2 
                              ? '4px solid var(--info-color)' 
                              : 'none',
                        ...(idx === 0 ? styles.winnerCard : {}),
                        ...(viewMode === 'card' ? styles.hoverLift : {}),
                        ...(viewMode === 'compact' ? styles.compactViewCard : {})
                      }}
                    >
                      <div className="d-flex align-items-center mb-2">
                        <div style={styles.positionIndicator} className="me-2">
                          {getPositionIcon(idx + 1)}
                        </div>
                        <h5 className="mb-0">{candidateResult.candidate.name}</h5>
                      </div>
                      
                      <div className="text-muted mb-2">{candidateResult.candidate.party}</div>
                      
                      <div className="vote-stats">
                        <div className="d-flex justify-content-between mb-1">
                          <span><FontAwesomeIcon icon={faVoteYea} className="me-1" /> {candidateResult.votes} votes</span>
                          <span><FontAwesomeIcon icon={faPercentage} className="me-1" /> {votePercentage}%</span>
                        </div>
                        <ProgressBar 
                          now={votePercentage} 
                          variant={idx === 0 ? 'success' : idx === 1 ? 'primary' : 'info'} 
                          className="animate-progress"
                          style={{
                            height: '8px',
                            transition: `width ${(idx + 1) * 0.5}s ease-in-out`
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ElectionResults;