import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import PageTitle from '../../components/PageTitle';

const VerifyOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get CNIC and email from location state (passed from ForgotPassword)
  const [userData, setUserData] = useState({
    cnic: location.state?.cnic || '',
    email: location.state?.email || '',
    otp: ''
  });
  
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, variant: '', message: '' });
  
  const { cnic, email, otp } = userData;
  
  // Check if we have the required data
  useEffect(() => {
    if (!cnic || !email) {
      setAlert({
        show: true,
        variant: 'danger',
        message: 'Missing required information. Please go back to the forgot password page.'
      });
    }
  }, [cnic, email]);
  
  const onChange = e => {
    setUserData({ ...userData, [e.target.name]: e.target.value });
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
    setLoading(true);
    
    try {
      // Verify the OTP
      const response = await axios.post(
        'http://localhost:5000/api/auth/voter/verify-reset-otp',
        { cnic, otp }
      );
      
      // Show success message
      setAlert({
        show: true,
        variant: 'success',
        message: response.data.message
      });
      
      // After 2 seconds, redirect to reset password page
      setTimeout(() => {
        navigate('/voter/reset-password/new-password', { 
          state: { 
            cnic,
            email,
            tempToken: response.data.tempToken
          }
        });
      }, 2000);
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setAlert({
        show: true,
        variant: 'danger',
        message: error.response?.data?.message || 'Failed to verify OTP. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container>
      <PageTitle title="Verify OTP" />
      <Row className="justify-content-center my-5">
        <Col lg={6} md={8}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <h2 className="text-center mb-4">Verify OTP</h2>
              
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
                Enter the One-Time Password (OTP) sent to your email address ({email}).
              </p>
              
              <Form noValidate validated={validated} onSubmit={handleSubmit}>
                <Form.Group className="mb-4">
                  <Form.Label>One-Time Password (OTP)</Form.Label>
                  <Form.Control
                    type="text"
                    name="otp"
                    placeholder="Enter the 6-digit OTP"
                    value={otp}
                    onChange={onChange}
                    required
                    minLength={6}
                    maxLength={6}
                    pattern="[0-9]{6}"
                  />
                  <Form.Control.Feedback type="invalid">
                    Please enter a valid 6-digit OTP.
                  </Form.Control.Feedback>
                </Form.Group>
                
                <div className="d-grid gap-2">
                  <Button variant="primary" type="submit" disabled={loading || !cnic || !email}>
                    {loading ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Verifying...
                      </>
                    ) : (
                      'Verify OTP'
                    )}
                  </Button>
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => navigate('/voter/forgot-password')}
                  >
                    Back
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

export default VerifyOTP;