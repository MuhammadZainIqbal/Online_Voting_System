import React, { useContext, useEffect, useState } from 'react';
import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faVoteYea, 
  faUserShield, 
  faIdCard, 
  faLock, 
  faUserSecret, 
  faCheckDouble,
  faShieldAlt,
  faFingerprint,
  faChartLine
} from '@fortawesome/free-solid-svg-icons';
import { AuthContext } from '../context/AuthContext';
import PageTitle from '../components/PageTitle';
import ElectionResults from '../components/ElectionResults';

const Home = () => {
  const { isAuthenticated, role } = useContext(AuthContext);
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);
  
  // Redirect authenticated users to their respective dashboards
  useEffect(() => {
    if (isAuthenticated) {
      if (role === 'voter') {
        navigate('/voter/dashboard');
      } else if (role === 'admin') {
        navigate('/admin/dashboard');
      }
    }
  }, [isAuthenticated, role, navigate]);

  return (
    <>
      <PageTitle title="Home" />
      
      {/* Enhanced Hero Section with gradient background and wave pattern */}
      <div className="hero-gradient-bg my-5">
        <Container>
          <Row className="align-items-center">
            <Col lg={7} className="hero-content text-center text-lg-start">
              <h1 className="hero-title display-4 fw-bold mb-3">Secure Online Voting System</h1>
              <p className="hero-subtitle fs-5 fw-light mb-4">
                A blockchain-based e-voting system with advanced cryptographic privacy protections
              </p>
              <div className="d-flex justify-content-center justify-content-lg-start gap-3 mt-4">
                <Link to="/voter/login">
                  <Button size="lg" variant="light" className="px-4 py-2 shadow-sm">
                    <FontAwesomeIcon icon={faVoteYea} className="me-2" />
                    Voter Access
                  </Button>
                </Link>
                <Link to="/admin/login">
                  <Button size="lg" variant="outline-light" className="px-4 py-2">
                    <FontAwesomeIcon icon={faUserShield} className="me-2" />
                    Admin Portal
                  </Button>
                </Link>
              </div>
            </Col>
            <Col lg={5} className="d-none d-lg-block">
              <div className="text-center">
                {!imageError ? (
                  <img 
                    src="/images/vote-illustration.svg" 
                    alt="Secure Voting" 
                    className="img-fluid mt-4" 
                    onError={() => setImageError(true)}
                    style={{ maxWidth: '90%' }}
                  />
                ) : (
                  <div className="fallback-image-container mt-4" style={{ maxWidth: '90%', margin: '0 auto' }}>
                    <div className="text-center p-4 rounded" style={{ 
                      background: 'rgba(255, 255, 255, 0.2)', 
                      border: '1px dashed rgba(255, 255, 255, 0.3)',
                      borderRadius: 'var(--border-radius-lg)',
                      height: '300px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FontAwesomeIcon icon={faVoteYea} style={{ fontSize: '64px', color: 'white', marginBottom: '1rem' }} />
                      <h3 className="text-white mb-3">Secure Voting</h3>
                      <p className="text-white-50 mb-0">
                        Blockchain-secured electronic voting system
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Container>
      </div>

      <Container>
        {/* Features Section with curvier cards */}
        <Row className="mb-5">
          <Col md={6} className="mb-4 slide-up">
            <Card className="h-100 card-modern election-card shadow-lg">
              <Card.Body className="d-flex flex-column p-4">
                <div className="text-center mb-4">
                  <div className="feature-icon mx-auto mb-3">
                    <FontAwesomeIcon icon={faVoteYea} size="2x" />
                  </div>
                  <Badge bg="primary" pill className="mb-3 py-2 px-3">For Voters</Badge>
                </div>
                <Card.Text className="mb-4">
                  Cast your vote securely from anywhere. Our system ensures:
                </Card.Text>
                <ul className="feature-list mb-4">
                  <li className="mb-2">
                    <FontAwesomeIcon icon={faUserSecret} className="text-primary me-2" />
                    <strong>Complete anonymity</strong> through ring signatures
                  </li>
                  <li className="mb-2">
                    <FontAwesomeIcon icon={faFingerprint} className="text-primary me-2" />
                    <strong>Verifiable voting record</strong> on blockchain
                  </li>
                  <li className="mb-2">
                    <FontAwesomeIcon icon={faShieldAlt} className="text-primary me-2" />
                    <strong>Protection</strong> against tampering and fraud
                  </li>
                  <li className="mb-2">
                    <FontAwesomeIcon icon={faCheckDouble} className="text-primary me-2" />
                    <strong>Simple and intuitive</strong> voting experience
                  </li>
                </ul>
                <div className="mt-auto text-center">
                  <Link to="/voter/login">
                    <Button variant="primary" className="px-4 py-2 w-75 shadow">
                      <FontAwesomeIcon icon={faVoteYea} className="me-2" />
                      Voter Login
                    </Button>
                  </Link>
                </div>
              </Card.Body>
            </Card>
          </Col>
          
          <Col md={6} className="mb-4 slide-up" style={{animationDelay: '0.2s'}}>
            <Card className="h-100 card-modern election-card shadow-lg">
              <Card.Body className="d-flex flex-column p-4">
                <div className="text-center mb-4">
                  <div className="feature-icon mx-auto mb-3">
                    <FontAwesomeIcon icon={faUserShield} size="2x" />
                  </div>
                  <Badge bg="secondary" pill className="mb-3 py-2 px-3">For Administrators</Badge>
                </div>
                <Card.Text className="mb-4">
                  Manage elections with powerful administrative tools:
                </Card.Text>
                <ul className="feature-list mb-4">
                  <li className="mb-2">
                    <FontAwesomeIcon icon={faIdCard} className="text-secondary me-2" />
                    <strong>Create and configure</strong> elections
                  </li>
                  <li className="mb-2">
                    <FontAwesomeIcon icon={faLock} className="text-secondary me-2" />
                    <strong>Register voters</strong> and manage candidates
                  </li>
                  <li className="mb-2">
                    <FontAwesomeIcon icon={faChartLine} className="text-secondary me-2" />
                    <strong>Monitor election progress</strong> in real-time
                  </li>
                  <li className="mb-2">
                    <FontAwesomeIcon icon={faCheckDouble} className="text-secondary me-2" />
                    <strong>View transparent</strong> and verifiable results
                  </li>
                </ul>
                <div className="mt-auto text-center">
                  <Link to="/admin/login">
                    <Button variant="secondary" className="px-4 py-2 w-75 shadow">
                      <FontAwesomeIcon icon={faUserShield} className="me-2" />
                      Administrator Login
                    </Button>
                  </Link>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Process Section with curvier circles */}
        <Row className="mb-5">
          <Col>
            <Card className="card-modern shadow">
              <Card.Body className="py-5 px-4">
                <Card.Title className="text-center mb-5 h3">How Our Secure Voting System Works</Card.Title>
                <Row>
                  <Col md={3} className="text-center mb-4 slide-up" style={{animationDelay: '0.1s'}}>
                    <div className="feature-icon bg-primary bg-opacity-10 mx-auto mb-3">
                      <FontAwesomeIcon icon={faIdCard} />
                    </div>
                    <h5 className="mt-3 fw-bold">Registration</h5>
                    <p className="text-muted">Register with your ID and get your secure key pair</p>
                  </Col>
                  <Col md={3} className="text-center mb-4 slide-up" style={{animationDelay: '0.2s'}}>
                    <div className="feature-icon bg-secondary bg-opacity-10 mx-auto mb-3">
                      <FontAwesomeIcon icon={faLock} />
                    </div>
                    <h5 className="mt-3 fw-bold">Authentication</h5>
                    <p className="text-muted">Authenticate securely with your digital credentials</p>
                  </Col>
                  <Col md={3} className="text-center mb-4 slide-up" style={{animationDelay: '0.3s'}}>
                    <div className="feature-icon bg-success bg-opacity-10 mx-auto mb-3">
                      <FontAwesomeIcon icon={faUserSecret} />
                    </div>
                    <h5 className="mt-3 fw-bold">Anonymous Vote</h5>
                    <p className="text-muted">Cast your vote with ring signature and mixnet anonymization</p>
                  </Col>
                  <Col md={3} className="text-center mb-4 slide-up" style={{animationDelay: '0.4s'}}>
                    <div className="feature-icon bg-info bg-opacity-10 mx-auto mb-3">
                      <FontAwesomeIcon icon={faCheckDouble} />
                    </div>
                    <h5 className="mt-3 fw-bold">Verification</h5>
                    <p className="text-muted">Votes are recorded on blockchain for tamper-proof verification</p>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* Election Results Section with improved header */}
        <Row className="mb-5">
          <Col>
            <Card className="card-modern shadow">
              <Card.Header className="p-4 bg-gradient-primary text-white border-0">
                <h3 className="mb-0 fw-bold">Live Election Results</h3>
                <p className="mb-0 mt-2 opacity-75">Real-time, transparent election data secured by blockchain</p>
              </Card.Header>
              {/* Using the ElectionResults component with auto-refresh */}
              <ElectionResults refreshInterval={60000} maxResults={3} />
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default Home;