import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Button, ListGroup, Badge, Alert, Tabs, Tab } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import PageTitle from '../../components/PageTitle';
import ElectionResults from '../../components/ElectionResults';

const Dashboard = () => {
  const { user, token, verifyToken, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState({
    activeElections: 0,
    upcomingElections: 0,
    completedElections: 0,
    totalVoters: 0,
    totalCandidates: 0
  });
  const [recentElections, setRecentElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Verify token validity when component mounts
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isValid = await verifyToken();
        if (!isValid) {
          setAuthError(true);
          // Redirect to login after a delay
          setTimeout(() => {
            logout();
            navigate('/admin/login');
          }, 2000);
        }
      } catch (error) {
        console.error('Auth verification error:', error);
        setAuthError(true);
      }
    };

    checkAuth();
  }, [verifyToken, logout, navigate]);

  // Check for tab query parameter when component mounts
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'results') {
      setActiveTab('results');
    }
  }, [location.search]);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        setLoading(true);
        
        // Configure axios to use the auth token
        const config = {
          headers: { Authorization: `Bearer ${token}` }
        };
        
        // Fetch all elections
        const electionsResponse = await axios.get('http://localhost:5000/api/elections', config);
        const elections = electionsResponse.data;
        
        // Get counts for election stats
        const active = elections.filter(e => e.status === 'active').length;
        const upcoming = elections.filter(e => e.status === 'upcoming').length;
        const completed = elections.filter(e => e.status === 'completed').length;
        
        // Get the 5 most recent elections
        const recent = [...elections].sort((a, b) => 
          new Date(b.start_time) - new Date(a.start_time)
        ).slice(0, 5);
        
        // Fetch voter count
        let voterCount = 0;
        try {
          const votersResponse = await axios.get('http://localhost:5000/api/auth/voters/count', config);
          voterCount = votersResponse.data.count;
        } catch (error) {
          console.error('Error fetching voter count:', error);
          // Default to 0 if endpoint not available yet
        }
        
        // Fetch candidate count
        let candidateCount = 0;
        try {
          const candidatesResponse = await axios.get('http://localhost:5000/api/candidates/count', config);
          candidateCount = candidatesResponse.data.count;
        } catch (error) {
          console.error('Error fetching candidate count:', error);
          // Default to 0 if endpoint not available yet
        }
        
        setStats({
          activeElections: active,
          upcomingElections: upcoming,
          completedElections: completed,
          totalVoters: voterCount,
          totalCandidates: candidateCount
        });
        
        setRecentElections(recent);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        setLoading(false);
        
        // If we get a 401 or 403 error, the token is invalid or expired
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          setAuthError(true);
          setTimeout(() => {
            logout();
            navigate('/admin/login');
          }, 2000);
        }
      }
    };

    // Set up periodic refresh (every 30 seconds)
    if (!authError) {
      fetchAdminData();
      
      const interval = setInterval(fetchAdminData, 30000);
      return () => clearInterval(interval);
    }
  }, [token, authError, logout, navigate]);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const getStatusBadge = (status) => {
    if (status === 'active') {
      return <Badge bg="success">Active</Badge>;
    } else if (status === 'upcoming') {
      return <Badge bg="warning" text="dark">Upcoming</Badge>;
    } else {
      return <Badge bg="secondary">Completed</Badge>;
    }
  };

  if (authError) {
    return (
      <Container className="mt-5">
        <Alert variant="danger">
          Authentication error. Please log in again. Redirecting to login page...
        </Alert>
      </Container>
    );
  }

  return (
    <Container>
      <PageTitle title="Admin Dashboard" />
      <h2 className="my-4">Administrator Dashboard</h2>
      
      <Tabs 
        activeKey={activeTab}
        onSelect={(k) => setActiveTab(k)}
        className="mb-4"
      >
        <Tab eventKey="dashboard" title="Dashboard">
          <Card className="mb-4">
            <Card.Body>
              <Card.Title>Welcome, Administrator</Card.Title>
              <Card.Text>
                CNIC: {user?.cnic}
                <br />
                Email: {user?.email}
              </Card.Text>
            </Card.Body>
          </Card>

          <Row className="mb-4">
            <Col md={3}>
              <Card className="text-center h-100 shadow-sm">
                <Card.Body>
                  <h2 className="display-4">{stats.activeElections}</h2>
                  <Card.Title>Active Elections</Card.Title>
                </Card.Body>
                <Card.Footer>
                  <Link to="/admin/manage-elections">
                    <Button variant="primary" size="sm">Manage</Button>
                  </Link>
                </Card.Footer>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center h-100 shadow-sm">
                <Card.Body>
                  <h2 className="display-4">{stats.upcomingElections}</h2>
                  <Card.Title>Upcoming Elections</Card.Title>
                </Card.Body>
                <Card.Footer>
                  <Link to="/admin/manage-elections">
                    <Button variant="primary" size="sm">Manage</Button>
                  </Link>
                </Card.Footer>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center h-100 shadow-sm">
                <Card.Body>
                  <h2 className="display-4">{stats.totalVoters}</h2>
                  <Card.Title>Registered Voters</Card.Title>
                </Card.Body>
                <Card.Footer>
                  <Link to="/admin/register-voter">
                    <Button variant="primary" size="sm">Register New</Button>
                  </Link>
                </Card.Footer>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="text-center h-100 shadow-sm">
                <Card.Body>
                  <h2 className="display-4">{stats.completedElections}</h2>
                  <Card.Title>Completed Elections</Card.Title>
                </Card.Body>
                <Card.Footer>
                  <Button 
                    variant="primary" 
                    size="sm"
                    onClick={() => setActiveTab('results')}
                  >
                    View Results
                  </Button>
                </Card.Footer>
              </Card>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Card className="mb-4 shadow-sm">
                <Card.Header>Recent Elections</Card.Header>
                <ListGroup variant="flush">
                  {loading ? (
                    <ListGroup.Item>Loading...</ListGroup.Item>
                  ) : recentElections.length > 0 ? (
                    recentElections.map(election => (
                      <ListGroup.Item key={election.election_id} className="d-flex justify-content-between align-items-center">
                        <div>
                          <strong>{election.title}</strong>
                          <br />
                          <small>{formatDate(election.start_time)}</small>
                        </div>
                        <div>
                          {getStatusBadge(election.status)}
                          {election.status === 'completed' && (
                            <Button 
                              variant="link" 
                              size="sm"
                              className="ms-2"
                              onClick={() => setActiveTab('results')}
                            >
                              Results
                            </Button>
                          )}
                        </div>
                      </ListGroup.Item>
                    ))
                  ) : (
                    <ListGroup.Item>No elections found</ListGroup.Item>
                  )}
                </ListGroup>
                <Card.Footer>
                  <Link to="/admin/manage-elections">
                    <Button variant="outline-primary" size="sm">View All Elections</Button>
                  </Link>
                </Card.Footer>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="mb-4 shadow-sm">
                <Card.Header>Quick Actions</Card.Header>
                <Card.Body>
                  <div className="d-grid gap-2">
                    <Link to="/admin/register-voter">
                      <Button variant="outline-primary" className="w-100">Register New Voter</Button>
                    </Link>
                    <Link to="/admin/manage-elections">
                      <Button variant="outline-primary" className="w-100">Create New Election</Button>
                    </Link>
                    <Link to="/admin/manage-candidates">
                      <Button variant="outline-primary" className="w-100">Add Candidate</Button>
                    </Link>
                    <Link to="/admin/change-password">
                      <Button variant="outline-primary" className="w-100">Change Password</Button>
                    </Link>
                  </div>
                </Card.Body>
              </Card>
              
              <Card className="mb-4 shadow-sm bg-light">
                <Card.Body>
                  <Card.Title>System Security</Card.Title>
                  <Card.Text>
                    All voting data is secured using blockchain technology and asymmetric encryption. 
                    Voter privacy is protected through mixnet anonymization and ring signatures.
                  </Card.Text>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Tab>
        
        <Tab eventKey="results" title="Election Results">
          <Card>
            <Card.Body>
              <h3 className="mb-4">Election Results</h3>
              <ElectionResults refreshInterval={30000} />
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>
    </Container>
  );
};

export default Dashboard;