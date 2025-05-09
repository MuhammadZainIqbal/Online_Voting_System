import React, { useState, useContext, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faUserShield, faSignInAlt, faLock, faIdCard } from '@fortawesome/free-solid-svg-icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import PageTitle from '../../components/PageTitle';

const AdminLogin = () => {
  const { loginAdmin, error, clearError, loading, isAuthenticated, role } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  
  // Redirect if already authenticated as an admin
  useEffect(() => {
    if (isAuthenticated && role === 'admin') {
      const from = location.state?.from?.pathname || '/admin/dashboard';
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
  
  const togglePassword = () => setShowPassword(!showPassword);
  
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
    const success = await loginAdmin(formData.cnic, formData.password);
    
    if (success) {
      navigate('/admin/dashboard');
    }
  };
  
  return (
    <Container>
      <PageTitle title="Admin Login" />
      <Row className="justify-content-center my-5 fade-in">
        <Col lg={6} md={8}>
          <Card className="auth-card">
            <div className="auth-header">
              <div className="auth-icon">
                <FontAwesomeIcon icon={faUserShield} size="lg" />
              </div>
              <h2 className="auth-title">Admin Login</h2>
              <p className="auth-subtitle">Election Commission Administrator Portal</p>
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
                    Administrator CNIC
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
                      className="auth-input"
                    />
                    <InputGroup.Text 
                      onClick={togglePassword} 
                      style={{ cursor: 'pointer', borderTopRightRadius: '8px', borderBottomRightRadius: '8px' }}
                    >
                      <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                    </InputGroup.Text>
                    <Form.Control.Feedback type="invalid">
                      Please enter your password.
                    </Form.Control.Feedback>
                  </InputGroup>
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
                        Authenticating...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faSignInAlt} className="me-2" />
                        Access Admin Portal
                      </>
                    )}
                  </Button>
                </div>
              </Form>
              
              <div className="mt-4 text-center border-top pt-4">
                <p className="text-muted">
                  Admin accounts are provisioned by the Election Commission.
                </p>
                <p className="text-muted small mt-2">
                  <FontAwesomeIcon icon={faUserShield} className="me-1" />
                  Restricted access for authorized personnel only.
                </p>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AdminLogin;