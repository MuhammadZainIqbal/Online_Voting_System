import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup, Spinner } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import PageTitle from '../../components/PageTitle';

const ResetPassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get tempToken from location state (passed from VerifyOTP)
  const [formData, setFormData] = useState({
    tempToken: location.state?.tempToken || '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, variant: '', message: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { tempToken, newPassword, confirmPassword } = formData;
  
  // Check if we have the required data
  useEffect(() => {
    if (!tempToken) {
      setAlert({
        show: true,
        variant: 'danger',
        message: 'Missing required information. Please go through the password reset flow from the beginning.'
      });
    }
  }, [tempToken]);
  
  const onChange = e => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
    
    // Check if passwords match
    if (newPassword !== confirmPassword) {
      setAlert({
        show: true,
        variant: 'danger',
        message: 'Passwords do not match'
      });
      return;
    }
    
    // Check password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      setAlert({
        show: true,
        variant: 'danger',
        message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character'
      });
      return;
    }
    
    setValidated(true);
    setLoading(true);
    
    try {
      // Reset password
      const response = await axios.post(
        'http://localhost:5000/api/auth/voter/reset-password',
        { tempToken, newPassword, confirmPassword }
      );
      
      // Show success message
      setAlert({
        show: true,
        variant: 'success',
        message: response.data.message
      });
      
      // After 3 seconds, redirect to login page
      setTimeout(() => {
        navigate('/voter/login');
      }, 3000);
    } catch (error) {
      console.error('Error resetting password:', error);
      setAlert({
        show: true,
        variant: 'danger',
        message: error.response?.data?.message || 'Failed to reset password. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Toggle password visibility
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  // Toggle confirm password visibility
  const toggleConfirmPasswordVisibility = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };
  
  return (
    <Container>
      <PageTitle title="Reset Password" />
      <Row className="justify-content-center my-5">
        <Col lg={6} md={8}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <h2 className="text-center mb-4">Reset Your Password</h2>
              
              {alert.show && (
                <Alert 
                  variant={alert.variant} 
                  onClose={() => setAlert({ ...alert, show: false })} 
                  dismissible
                >
                  {alert.message}
                </Alert>
              )}
              
              <p className="text-muted mb-4">
                Create a new password for your account. Make sure it's strong and secure.
              </p>
              
              <Form noValidate validated={validated} onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>New Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showPassword ? "text" : "password"}
                      name="newPassword"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={onChange}
                      required
                      minLength={8}
                    />
                    <Button variant="outline-secondary" onClick={togglePasswordVisibility}>
                      <FontAwesomeIcon icon={showPassword ? faEyeSlash : faEye} />
                    </Button>
                  </InputGroup>
                  <Form.Text className="text-muted">
                    Password must be at least 8 characters and include uppercase, lowercase, number, and special character.
                  </Form.Text>
                </Form.Group>
                
                <Form.Group className="mb-4">
                  <Form.Label>Confirm Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={onChange}
                      required
                      minLength={8}
                    />
                    <Button variant="outline-secondary" onClick={toggleConfirmPasswordVisibility}>
                      <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
                    </Button>
                  </InputGroup>
                  <Form.Control.Feedback type="invalid">
                    Please confirm your password.
                  </Form.Control.Feedback>
                </Form.Group>
                
                <div className="d-grid gap-2">
                  <Button variant="primary" type="submit" disabled={loading || !tempToken}>
                    {loading ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Resetting Password...
                      </>
                    ) : (
                      'Reset Password'
                    )}
                  </Button>
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => navigate('/voter/login')}
                  >
                    Cancel
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ResetPassword;