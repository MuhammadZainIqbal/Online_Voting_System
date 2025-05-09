import React, { useState, useContext, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faIdCard, faSignInAlt, faLock } from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import PageTitle from '../../components/PageTitle';

const VoterLogin = () => {
  const { loginVoter, error, clearError, loading, isAuthenticated, role } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Redirect if already authenticated as a voter
  useEffect(() => {
    if (isAuthenticated && role === 'voter') {
      const from = location.state?.from?.pathname || '/voter/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, role, navigate, location]);
  
  const [formData, setFormData] = useState({
    cnic: '',
    password: ''
  });
  const [validated, setValidated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const handleChange = (e) => {
    clearError();
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    // Form validation
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setValidated(true);
      return;
    }
    
    setValidated(true);
    
    // Call login function from context
    const success = await loginVoter(formData.cnic, formData.password);
    
    if (success) {
      navigate('/voter/dashboard');
    }
  };
  
  return (
    <Container>
      <PageTitle title="Voter Login" />
      <Row className="justify-content-center my-5 fade-in">
        <Col lg={6} md={8}>
          <Card className="auth-card">
            <div className="auth-header">
              <div className="auth-icon">
                <FontAwesomeIcon icon={faIdCard} size="lg" />
              </div>
              <h2 className="auth-title">Voter Login</h2>
              <p className="auth-subtitle">Access your secure voting dashboard</p>
            </div>
            
            <Card.Body className="auth-form">
              {error && (
                <Alert variant="danger" onClose={clearError} dismissible className="mb-4">
                  {error}
                </Alert>
              )}
              
              <Form noValidate validated={validated} onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <FontAwesomeIcon icon={faIdCard} className="me-2 text-primary" />
                    CNIC Number
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="cnic"
                    placeholder="Enter your 13-digit CNIC"
                    value={formData.cnic}
                    onChange={handleChange}
                    required
                    pattern="[0-9]{13}"
                    className="auth-input"
                  />
                  <Form.Control.Feedback type="invalid">
                    Please enter a valid 13-digit CNIC number without dashes.
                  </Form.Control.Feedback>
                </Form.Group>
                
                <Form.Group className="mb-4">
                  <Form.Label>
                    <FontAwesomeIcon icon={faLock} className="me-2 text-primary" />
                    Password
                  </Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Enter your secure password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      minLength={8}
                      className="auth-input"
                    />
                    <InputGroup.Text 
                      onClick={() => setShowPassword(!showPassword)} 
                      style={{ cursor: 'pointer', borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}
                    >
                      <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                    </InputGroup.Text>
                    <Form.Control.Feedback type="invalid">
                      Password must be at least 8 characters long.
                    </Form.Control.Feedback>
                  </InputGroup>
                  <div className="text-end mt-2">
                    <a href="/voter/forgot-password" className="text-decoration-none small text-primary">Forgot password?</a>
                  </div>
                </Form.Group>
                
                <div className="d-grid mt-4">
                  <Button 
                    variant="primary" 
                    type="submit" 
                    disabled={loading}
                    className="auth-btn"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Logging in...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faSignInAlt} className="me-2" />
                        Login to Vote
                      </>
                    )}
                  </Button>
                </div>
              </Form>
              
              <div className="mt-4 text-center border-top pt-4">
                <p className="text-muted">
                  Not registered yet? Voter registration is handled by the Election Commission.
                </p>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default VoterLogin;