import React, { useState, useContext } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faIdCard, faUser, faEnvelope, faKey, faLock, faPaperPlane } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import PageTitle from '../../components/PageTitle';

const RegisterVoter = () => {
  const { token } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    cnic: '',
    email: '',
    otp: '',
    password: '',
    confirmPassword: ''
  });
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, variant: '', message: '' });
  
  // State for password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // State variable for the multi-step form
  const [step, setStep] = useState(1); // 1: Initial form, 2: OTP verification, 3: Password setting

  const { cnic, email, otp, password, confirmPassword } = formData;

  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  // Toggle password visibility
  const togglePassword = () => setShowPassword(!showPassword);
  const toggleConfirmPassword = () => setShowConfirmPassword(!showConfirmPassword);

  const sendOtp = async (e) => {
    e.preventDefault();
    
    // Form validation for CNIC and email
    if (!formData.cnic || !formData.email || !cnic.match(/^[0-9]{13}$/)) {
      setValidated(true);
      return;
    }
    
    setLoading(true);
    
    try {
      // Configure axios to use the auth token
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      // Send OTP to email
      await axios.post(
        'http://localhost:5000/api/auth/voter/send-otp',
        { cnic, email },
        config
      );
      
      setAlert({
        show: true,
        variant: 'success',
        message: `OTP sent to ${email}. Please check the email and enter the OTP below.`
      });
      
      setStep(2);
    } catch (error) {
      console.error('Error sending OTP:', error);
      setAlert({
        show: true,
        variant: 'danger',
        message: error.response?.data?.message || 'Failed to send OTP. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    
    if (!formData.otp) {
      setAlert({
        show: true,
        variant: 'danger',
        message: 'Please enter the OTP'
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Configure axios to use the auth token
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      // Verify OTP
      await axios.post(
        'http://localhost:5000/api/auth/voter/verify-otp',
        { cnic, email, otp },
        config
      );
      
      setAlert({
        show: true,
        variant: 'success',
        message: 'Email verified successfully! Please set a password for the voter.'
      });
      
      // Clear OTP field after successful verification for security
      setFormData({
        ...formData,
        otp: ''
      });
      
      setStep(3);
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setAlert({
        show: true,
        variant: 'danger',
        message: error.response?.data?.message || 'Invalid OTP. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const completeRegistration = async (e) => {
    e.preventDefault();
    
    // Check if passwords match
    if (password !== confirmPassword) {
      setAlert({
        show: true,
        variant: 'danger',
        message: 'Passwords do not match'
      });
      return;
    }
    
    // Password validation
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      setAlert({
        show: true,
        variant: 'danger',
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Configure axios to use the auth token
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      // Complete voter registration
      await axios.post(
        'http://localhost:5000/api/auth/voter/complete-registration',
        { cnic, email, password },
        config
      );
      
      setAlert({
        show: true,
        variant: 'success',
        message: `Voter registered successfully! Private key has been sent to ${email}`
      });
      
      // Reset form
      setTimeout(() => {
        setFormData({
          cnic: '',
          email: '',
          otp: '',
          password: '',
          confirmPassword: ''
        });
        setValidated(false);
        setStep(1);
      }, 5000);
    } catch (error) {
      console.error('Error registering voter:', error);
      setAlert({
        show: true,
        variant: 'danger',
        message: error.response?.data?.message || 'Failed to register voter. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Render different form steps
  const renderFormStep = () => {
    switch (step) {
      case 1:
        return (
          <Form noValidate validated={validated} onSubmit={sendOtp}>
            <Form.Group className="mb-3">
              <Form.Label>
                <FontAwesomeIcon icon={faIdCard} className="me-2 text-primary" />
                CNIC
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter 13-digit CNIC number"
                name="cnic"
                value={cnic}
                onChange={onChange}
                required
                pattern="^[0-9]{13}$"
                className="auth-input"
              />
              <Form.Control.Feedback type="invalid">
                Please enter a valid 13-digit CNIC number.
              </Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>
                <FontAwesomeIcon icon={faEnvelope} className="me-2 text-primary" />
                Email
              </Form.Label>
              <Form.Control
                type="email"
                placeholder="Enter email address"
                name="email"
                value={email}
                onChange={onChange}
                required
                className="auth-input"
              />
              <Form.Control.Feedback type="invalid">
                Please enter a valid email address.
              </Form.Control.Feedback>
              <Form.Text className="text-muted">
                An OTP will be sent to this email for verification.
              </Form.Text>
            </Form.Group>

            <div className="d-grid gap-2 mt-4">
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
                    Sending OTP...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPaperPlane} className="me-2" />
                    Send OTP
                  </>
                )}
              </Button>
            </div>
          </Form>
        );

      case 2:
        return (
          <Form noValidate onSubmit={verifyOtp}>
            <Form.Group className="mb-4">
              <Form.Label>
                <FontAwesomeIcon icon={faKey} className="me-2 text-primary" />
                One-Time Password (OTP)
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter the OTP received in the email"
                name="otp"
                value={otp}
                onChange={onChange}
                required
                className="auth-input"
              />
              <Form.Control.Feedback type="invalid">
                Please enter the OTP.
              </Form.Control.Feedback>
            </Form.Group>

            <div className="d-grid gap-2 mt-4">
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
                    Verifying...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faKey} className="me-2" />
                    Verify OTP
                  </>
                )}
              </Button>
              <Button 
                variant="outline-secondary" 
                onClick={() => {
                  setStep(1);
                  setAlert({show: false});
                }}
                disabled={loading}
                className="mt-2"
              >
                Back
              </Button>
            </div>
          </Form>
        );

      case 3:
        return (
          <Form noValidate onSubmit={completeRegistration}>
            <Form.Group className="mb-3">
              <Form.Label>
                <FontAwesomeIcon icon={faLock} className="me-2 text-primary" />
                Password
              </Form.Label>
              <InputGroup>
                <Form.Control
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  name="password"
                  value={password}
                  onChange={onChange}
                  required
                  pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}"
                  className="auth-input"
                />
                <Button variant="outline-secondary" onClick={togglePassword}>
                  <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                </Button>
              </InputGroup>
              <Form.Text className="text-muted">
                Password must be at least 8 characters and include uppercase, lowercase, number, and special character.
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label>
                <FontAwesomeIcon icon={faLock} className="me-2 text-primary" />
                Confirm Password
              </Form.Label>
              <InputGroup>
                <Form.Control
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={onChange}
                  required
                  isInvalid={password !== confirmPassword && confirmPassword !== ''}
                  className="auth-input"
                />
                <Button variant="outline-secondary" onClick={toggleConfirmPassword}>
                  <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
                </Button>
              </InputGroup>
              <Form.Control.Feedback type="invalid">
                Passwords do not match.
              </Form.Control.Feedback>
            </Form.Group>

            <div className="d-grid gap-2 mt-4">
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
                    Completing Registration...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faUser} className="me-2" />
                    Complete Registration
                  </>
                )}
              </Button>
              <Button 
                variant="outline-secondary" 
                onClick={() => {
                  setStep(2);
                  setAlert({show: false});
                }}
                disabled={loading}
                className="mt-2"
              >
                Back
              </Button>
            </div>
          </Form>
        );

      default:
        return null;
    }
  };

  return (
    <Container>
      <PageTitle title="Register Voter" />
      <Row className="justify-content-center my-5 fade-in">
        <Col lg={8} md={10}>
          <Card className="auth-card">
            <div className="auth-header">
              <div className="auth-icon">
                <FontAwesomeIcon icon={faIdCard} size="lg" />
              </div>
              <h2 className="auth-title">Register New Voter</h2>
              <p className="auth-subtitle">Create voter accounts with secure verification</p>
            </div>
            <Card.Body className="auth-form">
              {alert.show && (
                <Alert 
                  variant={alert.variant} 
                  onClose={() => setAlert({ ...alert, show: false })} 
                  dismissible
                  className="mb-4"
                >
                  {alert.message}
                </Alert>
              )}
              
              <div className="mb-4">
                <div className="vote-steps">
                  <div className={`vote-step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
                    <div className="vote-step-number">1</div>
                    <div className="vote-step-label">Enter Details</div>
                    <div className="vote-step-line"></div>
                  </div>
                  <div className={`vote-step ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
                    <div className="vote-step-number">2</div>
                    <div className="vote-step-label">Verify Email</div>
                    <div className="vote-step-line"></div>
                  </div>
                  <div className={`vote-step ${step >= 3 ? 'active' : ''}`}>
                    <div className="vote-step-number">3</div>
                    <div className="vote-step-label">Set Password</div>
                  </div>
                </div>
                <p className="text-muted small text-center mt-3">
                  Upon successful registration, voters will receive their private key via email.
                  This key is required for voting and is not stored on the server for security reasons.
                </p>
              </div>
              
              {renderFormStep()}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default RegisterVoter;