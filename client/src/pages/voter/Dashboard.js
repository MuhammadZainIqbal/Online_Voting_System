import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Container, Row, Col, Card, Badge, 
  Button, Modal, Form, Alert, Spinner, Tabs, Tab
} from 'react-bootstrap';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import * as cryptoUtils from '../../crypto/cryptoUtils';
import ElectionResults from '../../components/ElectionResults';

const VoterDashboard = () => {
  const { token, user, logout, verifyToken } = useAuth();
  const navigate = useNavigate();
  
  const [elections, setElections] = useState([]);
  const [completedElections, setCompletedElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingCompleted, setLoadingCompleted] = useState(true);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [error, setError] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [selectedElection, setSelectedElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [privateKeyFile, setPrivateKeyFile] = useState(null);
  
  const [votingInProgress, setVotingInProgress] = useState(false);
  const [votingError, setVotingError] = useState(null);
  const [votingSuccess, setVotingSuccess] = useState(null);
  
  // New state for blind signature workflow
  const [blindSignatureStep, setBlindSignatureStep] = useState(1);
  const [blindingFactor, setBlindingFactor] = useState(null);
  const [blindedVoteHash, setBlindedVoteHash] = useState(null);
  const [blindSignature, setBlindSignature] = useState(null);
  const [unblindedSignature, setUnblindedSignature] = useState(null);
  const [voteHash, setVoteHash] = useState(null);

  // Fetch elections on component mount and set up auto-refresh
  useEffect(() => {
    const fetchElections = async () => {
      try {
        // Verify token is still valid
        const isTokenValid = await verifyToken();
        if (!isTokenValid) {
          setAuthError(true);
          setTimeout(() => {
            logout();
            navigate('/voter/login');
          }, 2000);
          return;
        }
        
        const config = {
          headers: { Authorization: `Bearer ${token}` }
        };
        
        const response = await axios.get('http://localhost:5000/api/elections/active', config);
        
        // Get voting status for each election
        const electionsWithStatus = await Promise.all(
          response.data.map(async (election) => {
            try {
              const statusResponse = await axios.get(
                `http://localhost:5000/api/vote/status/${election.election_id}`,
                config
              );
              
              return {
                ...election,
                voted: statusResponse.data.hasVoted
              };
            } catch (err) {
              console.error(`Error fetching status for election ${election.election_id}:`, err);
              return { ...election, voted: false };
            }
          })
        );
        
        setElections(electionsWithStatus);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching elections:', err);
        
        // Handle authentication errors
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          setAuthError(true);
          setTimeout(() => {
            logout();
            navigate('/voter/login');
          }, 2000);
        } else {
          setError('Failed to load elections. Please try again later.');
          setLoading(false);
        }
      }
    };
    
    // Fetch completed elections
    const fetchCompletedElections = async () => {
      try {
        if (!token) return;
        
        const config = {
          headers: { Authorization: `Bearer ${token}` }
        };
        
        const response = await axios.get('http://localhost:5000/api/elections/completed', config);
        setCompletedElections(response.data);
        setLoadingCompleted(false);
      } catch (err) {
        console.error('Error fetching completed elections:', err);
        setLoadingCompleted(false);
      }
    };
    
    // Fetch immediately on mount
    fetchElections();
    fetchCompletedElections();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchElections();
      fetchCompletedElections();
    }, 30000);
    
    // Clean up interval on component unmount
    return () => clearInterval(interval);
  }, [token, authError, logout, navigate, verifyToken]);

  // Handle candidate selection
  const handleCandidateChange = (e) => {
    setSelectedCandidate(e.target.value);
    setVotingError(null);
  };
  
  // Handle private key file upload
  const handlePrivateKeyUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPrivateKeyFile(file);
      setVotingError(null);
    }
  };
  
  // Reset blind signature process when modal is closed
  const handleCloseModal = () => {
    setShowVoteModal(false);
    setBlindSignatureStep(1);
    setBlindingFactor(null);
    setBlindedVoteHash(null);
    setBlindSignature(null);
    setUnblindedSignature(null);
    setVoteHash(null);
    setSelectedCandidate('');
    setPrivateKeyFile(null);
    setVotingError(null);
    setVotingSuccess(null);
  };
  
  // Step 1: Request authorization with a blinded vote hash
  const handleRequestAuthorization = async () => {
    if (!selectedCandidate) {
      setVotingError('Please select a candidate to vote for.');
      return;
    }
    
    if (!privateKeyFile) {
      setVotingError('Please upload your private key file.');
      return;
    }
    
    // Check file extension
    if (!privateKeyFile.name.endsWith('.pem')) {
      setVotingError('Invalid private key file. Please upload a .pem file.');
      return;
    }
    
    setVotingInProgress(true);
    setVotingError(null);
    
    try {
      // First, get the election authority's public key to create blind signature
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      // Create the vote message to be signed
      const voteMessage = `${user.cnic}:${selectedElection.election_id}:${selectedCandidate}`;
      
      // Generate a blinding factor
      // We need to first retrieve the authority's public key
      const adminResponse = await axios.get('http://localhost:5000/api/elections/authority-key', config);
      const authPublicKey = adminResponse.data.publicKey;
      
      // Generate blinding factor
      const blindingFactorData = cryptoUtils.generateBlindingFactor(authPublicKey);
      setBlindingFactor(blindingFactorData);
      
      // Blind the vote message
      const { messageHash, blindedMessage } = cryptoUtils.blindMessage(
        voteMessage, 
        blindingFactorData.r, 
        authPublicKey
      );
      
      setVoteHash(messageHash);
      setBlindedVoteHash(blindedMessage);
      
      // Request authorization from the election authority
      const authResponse = await axios.post(
        'http://localhost:5000/api/vote/request-authorization',
        {
          electionId: selectedElection.election_id,
          blindedVoteHash: blindedMessage
        },
        config
      );
      
      // Store the blind signature
      setBlindSignature(authResponse.data.blindSignature);
      
      // Unbind the signature
      const unblinded = cryptoUtils.unblindSignature(
        authResponse.data.blindSignature,
        blindingFactorData.rInverse,
        authPublicKey
      );
      
      setUnblindedSignature(unblinded);
      
      // Verify the unblinded signature locally
      const isValid = cryptoUtils.verifyBlindSignature(
        voteMessage,
        unblinded,
        authPublicKey
      );
      
      if (!isValid) {
        setVotingError('Blind signature verification failed. Please try again.');
        setVotingInProgress(false);
        return;
      }
      
      // Move to the next step
      setBlindSignatureStep(2);
      setVotingInProgress(false);
      
    } catch (error) {
      console.error('Error in authorization request:', error);
      setVotingError('Failed to get authorization: ' + 
        (error.response?.data?.message || error.message || 'Unknown error'));
      setVotingInProgress(false);
    }
  };
  
  // Step 2: Submit the vote with the blind signature
  const handleVoteSubmit = async () => {
    if (blindSignatureStep === 1) {
      handleRequestAuthorization();
      return;
    }
    
    if (!selectedCandidate || !unblindedSignature || !privateKeyFile) {
      setVotingError('Missing required information. Please try again.');
      return;
    }
    
    setVotingInProgress(true);
    setVotingError(null);
    
    try {
      // Read the private key file
      const privateKeyReader = new FileReader();
      
      privateKeyReader.onload = async (e) => {
        const privateKey = e.target.result;
        
        // Create voter signature for the vote
        let voterSignature;
        try {
          // The vote message format should match what was used in the blind signature
          const voteMessage = `${user.cnic}:${selectedElection.election_id}:${selectedCandidate}`;
          voterSignature = await cryptoUtils.signData(voteMessage, privateKey);
        } catch (cryptoError) {
          setVotingError('Error signing your vote: ' + (cryptoError.message || 'The key file may be invalid or corrupted.'));
          setVotingInProgress(false);
          return;
        }
        
        const config = {
          headers: { Authorization: `Bearer ${token}` }
        };
        
        try {
          // Send only voterSignature, not privateKey
          await axios.post(
            'http://localhost:5000/api/vote',
            {
              electionId: selectedElection.election_id,
              candidateId: selectedCandidate,
              privateKey: privateKey, // Add the private key to the request
              voterSignature: voterSignature,
              unblindedSignature: unblindedSignature,
              voteHash: voteHash
            },
            config
          );
          
          // Update local state to reflect the vote
          setElections(elections.map(election => 
            election.election_id === selectedElection.election_id
              ? { ...election, voted: true }
              : election
          ));
          
          setVotingSuccess('Your vote has been successfully recorded. Thank you for voting!');
          
          // Clear the private key file from memory for security
          setPrivateKeyFile(null);
          
          // Close modal after a delay
          setTimeout(() => {
            handleCloseModal();
          }, 3000);
        } catch (apiError) {
          console.error('Error from voting API:', apiError);
          
          // Handle specific API error responses
          if (apiError.response) {
            const errorMessage = apiError.response.data.message || 'Error submitting vote';
            setVotingError(
              apiError.response.status === 401 && errorMessage.includes('private key') 
                ? 'Authentication failed: Your private key is invalid or does not match your voter record. Please ensure you uploaded the correct key file.'
                : errorMessage
            );
          } else {
            setVotingError('Network error. Please try again later.');
          }
          
          setVotingInProgress(false);
        }
      };
      
      privateKeyReader.onerror = () => {
        setVotingError('Failed to read the private key file. The file may be corrupted.');
        setVotingInProgress(false);
      };
      
      privateKeyReader.readAsText(privateKeyFile);
    } catch (error) {
      console.error('Error processing vote submission:', error);
      setVotingError('An unexpected error occurred. Please try again.');
      setVotingInProgress(false);
    }
  };

  // Open voting modal
  const handleOpenVoteModal = async (election) => {
    // Verify token is still valid before allowing voting
    const isTokenValid = await verifyToken();
    if (!isTokenValid) {
      setAuthError(true);
      setTimeout(() => {
        logout();
        navigate('/voter/login');
      }, 2000);
      return;
    }

    setSelectedElection(election);
    setShowVoteModal(true);
    setVotingError(null);
    setVotingSuccess(null);
    setSelectedCandidate('');
    setBlindSignatureStep(1);
    setBlindingFactor(null);
    setBlindedVoteHash(null);
    setBlindSignature(null);
    setUnblindedSignature(null);
    setVoteHash(null);
    
    // Fetch candidates for this election
    try {
      setLoadingCandidates(true);
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      const response = await axios.get(
        `http://localhost:5000/api/candidates?electionId=${election.election_id}`, 
        config
      );
      
      setCandidates(response.data);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      
      // If we get a 401 or 403 error, the token is invalid or expired
      if (error.response && (error.response.status === 401 || error.response.status === 403)) {
        setAuthError(true);
        setTimeout(() => {
          logout();
          navigate('/voter/login');
        }, 2000);
      } else {
        setVotingError('Failed to load candidates. Please try again later.');
      }
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Get the status badge for an election
  const getStatusBadge = (status) => {
    switch (status) {
      case 'upcoming':
        return <Badge bg="info">Upcoming</Badge>;
      case 'active':
        return <Badge bg="success">Active</Badge>;
      case 'completed':
        return <Badge bg="secondary">Completed</Badge>;
      default:
        return <Badge bg="light">Unknown</Badge>;
    }
  };

  // Check if voter has already voted in an election
  const hasVoted = (election) => {
    return election.voted;
  };

  if (authError) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          Your session has expired. Redirecting to login...
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="mt-5 text-center">
        <Spinner animation="border" />
        <p className="mt-3">Loading elections...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Voter Dashboard</h2>
        <Link to="/voter/change-password" className="btn btn-outline-secondary">
          Change Password
        </Link>
      </div>
      
      <Tabs
        activeKey={activeTab}
        onSelect={(key) => setActiveTab(key)}
        className="mb-4"
      >
        <Tab eventKey="active" title="Active Elections">
          {loading ? (
            <div className="text-center my-4">
              <Spinner animation="border" role="status" variant="primary">
                <span className="visually-hidden">Loading elections...</span>
              </Spinner>
              <p className="mt-2">Loading active elections...</p>
            </div>
          ) : elections.length === 0 ? (
            <Alert variant="info">
              There are no active elections at the moment. Please check back later.
            </Alert>
          ) : (
            <Row>
              {elections.map(election => (
                <Col md={6} key={election.election_id} className="mb-4">
                  <Card className="h-100 shadow-sm">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <Card.Title>{election.title}</Card.Title>
                        {getStatusBadge(election.status)}
                      </div>
                      <Card.Text>
                        {election.description || 'No description provided'}
                      </Card.Text>
                      <div className="small text-muted mb-3">
                        {election.start_time && (
                          <div>Start: {new Date(election.start_time).toLocaleString()}</div>
                        )}
                        {election.end_time && (
                          <div>End: {new Date(election.end_time).toLocaleString()}</div>
                        )}
                      </div>
                      
                      {hasVoted(election) ? (
                        <Badge bg="success" className="p-2">
                          You have already voted in this election
                        </Badge>
                      ) : election.status === 'active' ? (
                        <Button 
                          variant="primary" 
                          onClick={() => handleOpenVoteModal(election)}
                        >
                          Cast Your Vote
                        </Button>
                      ) : (
                        <Badge bg="secondary" className="p-2">
                          {election.status === 'upcoming' ? 'Election has not started yet' : 'Election has ended'}
                        </Badge>
                      )}
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Tab>
        <Tab eventKey="completed" title="Completed Elections">
          {loadingCompleted ? (
            <div className="text-center my-4">
              <Spinner animation="border" role="status" variant="primary">
                <span className="visually-hidden">Loading completed elections...</span>
              </Spinner>
              <p className="mt-2">Loading completed elections...</p>
            </div>
          ) : completedElections.length === 0 ? (
            <Alert variant="info">
              There are no completed elections yet.
            </Alert>
          ) : (
            <Row>
              {completedElections.map(election => (
                <Col md={6} key={election.election_id} className="mb-4">
                  <Card className="h-100 shadow-sm">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <Card.Title>{election.title}</Card.Title>
                        {getStatusBadge(election.status)}
                      </div>
                      <div className="small text-muted mb-3">
                        {election.start_time && (
                          <div>Start: {new Date(election.start_time).toLocaleString()}</div>
                        )}
                        {election.end_time && (
                          <div>End: {new Date(election.end_time).toLocaleString()}</div>
                        )}
                      </div>
                      <Button 
                        variant="outline-primary" 
                        onClick={() => setActiveTab('results')}
                      >
                        View Results
                      </Button>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Tab>
        <Tab eventKey="results" title="Election Results">
          <Card>
            <ElectionResults refreshInterval={30000} />
          </Card>
        </Tab>
      </Tabs>
      
      {/* Voting Modal */}
      <Modal 
        show={showVoteModal} 
        onHide={handleCloseModal}
        backdrop="static"
        keyboard={false}
        size="lg"
      >
        <Modal.Header closeButton={!votingInProgress}>
          <Modal.Title>
            {selectedElection && (
              <span>Vote: {selectedElection.title}</span>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {votingError && (
            <Alert variant="danger">
              {votingError}
            </Alert>
          )}
          
          {votingSuccess ? (
            <Alert variant="success">
              {votingSuccess}
            </Alert>
          ) : (
            <>
              {loadingCandidates ? (
                <div className="text-center">
                  <Spinner animation="border" />
                  <p className="mt-2">Loading candidates...</p>
                </div>
              ) : (
                <Form>
                  <h5 className="mb-3">Step {blindSignatureStep}/2: {blindSignatureStep === 1 ? 'Authorize Vote' : 'Submit Vote'}</h5>
                  
                  {blindSignatureStep === 1 && (
                    <Alert variant="info" className="mb-3">
                      First, we'll authorize your vote without revealing your choice to the election authority.
                    </Alert>
                  )}
                  
                  {blindSignatureStep === 2 && (
                    <Alert variant="success" className="mb-3">
                      Your vote has been authorized! Now, submit your vote to complete the process.
                    </Alert>
                  )}
                  
                  <Form.Group className="mb-4">
                    <Form.Label><strong>Select a candidate:</strong></Form.Label>
                    {candidates.map(candidate => (
                      <div 
                        key={candidate.candidate_id}
                        className="candidate-option border rounded p-3 mb-2"
                        style={{ 
                          cursor: 'pointer',
                          backgroundColor: selectedCandidate === candidate.candidate_id ? '#f0f9ff' : 'white',
                          borderColor: selectedCandidate === candidate.candidate_id ? '#0d6efd' : '#dee2e6'
                        }}
                        onClick={() => setSelectedCandidate(candidate.candidate_id)}
                      >
                        <div className="d-flex align-items-center">
                          <Form.Check 
                            type="radio"
                            id={`candidate-${candidate.candidate_id}`}
                            value={candidate.candidate_id}
                            checked={selectedCandidate === candidate.candidate_id}
                            onChange={handleCandidateChange}
                            className="me-3"
                            style={{ transform: 'scale(1.2)' }}
                          />
                          <div>
                            <h6 className="mb-1">{candidate.name}</h6>
                            <div className="text-muted">Party: {candidate.party}</div>
                            {candidate.symbol && (
                              <span className="badge bg-light text-dark">Symbol: {candidate.symbol}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </Form.Group>
                  
                  <Form.Group className="mb-4">
                    <Form.Label><strong>Upload your private key:</strong></Form.Label>
                    <Form.Control 
                      type="file" 
                      accept=".pem"
                      onChange={handlePrivateKeyUpload}
                    />
                    <Form.Text className="text-muted">
                      The private key file you received during registration (.pem format)
                    </Form.Text>
                  </Form.Group>
                  
                  {blindingFactor && blindSignature && (
                    <div className="bg-light p-3 rounded mb-3">
                      <p className="small mb-1">Blinded vote hash: <code>{blindedVoteHash.substring(0, 20)}...{blindedVoteHash.substring(blindedVoteHash.length - 20)}</code></p>
                      <p className="small mb-0">Blind signature: <code>{blindSignature.substring(0, 20)}...{blindSignature.substring(blindSignature.length - 20)}</code></p>
                    </div>
                  )}
                  
                  <Alert variant="info" className="mt-3">
                    <small>
                      Your vote will be anonymized using ring signatures and recorded on the blockchain.
                      This ensures that your vote remains private while still being verifiable.
                    </small>
                  </Alert>
                </Form>
              )}
            </>
          )}
        </Modal.Body>
        {!votingSuccess && (
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseModal} disabled={votingInProgress}>
              Cancel
            </Button>
            <Button 
              variant="primary" 
              onClick={handleVoteSubmit}
              disabled={!selectedCandidate || votingInProgress}
            >
              {votingInProgress ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  {blindSignatureStep === 1 ? 'Authorizing...' : 'Submitting...'}
                </>
              ) : (
                blindSignatureStep === 1 ? 'Authorize Vote' : 'Submit Vote'
              )}
            </Button>
          </Modal.Footer>
        )}
      </Modal>
    </Container>
  );
};

export default VoterDashboard;