import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PageTitle from '../../components/PageTitle';

const ForgotPassword = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    cnic: '',
    email: ''
  });
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, variant: '', message: '' });
  
  const { cnic, email } = formData;
  
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
    
    setValidated(true);
    setLoading(true);
    
    try {
      // Request password reset OTP
      const response = await axios.post(
        'http://localhost:5000/api/auth/voter/forgot-password',
        { cnic, email }
      );
      
      // Show success message
      setAlert({
        show: true,
        variant: 'success',
        message: response.data.message
      });
      
      // After 2 seconds, redirect to OTP verification page
      setTimeout(() => {
        navigate('/voter/reset-password/verify-otp', { 
          state: { cnic, email }
        });
      }, 2000);
    } catch (error) {
      console.error('Error requesting password reset:', error);
      setAlert({
        show: true,
        variant: 'danger',
        message: error.response?.data?.message || 'Failed to request password reset. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container>
      <PageTitle title="Forgot Password" />
      <Row className="justify-content-center my-5">
        <Col lg={6} md={8}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <h2 className="text-center mb-4">Forgot Password</h2>
              
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
                Enter your CNIC and registered email address. We'll send you a One-Time Password (OTP) to verify your identity.
              </p>
              
              <Form noValidate validated={validated} onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>CNIC</Form.Label>
                  <Form.Control
                    type="text"
                    name="cnic"
                    placeholder="Enter your 13-digit CNIC"
                    value={cnic}
                    onChange={onChange}
                    required
                    pattern="[0-9]{13}"
                  />
                  <Form.Control.Feedback type="invalid">
                    Please enter a valid 13-digit CNIC number.
                  </Form.Control.Feedback>
                </Form.Group>
                
                <Form.Group className="mb-4">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={onChange}
                    required
                  />
                  <Form.Control.Feedback type="invalid">
                    Please enter a valid email address.
                  </Form.Control.Feedback>
                </Form.Group>
                
                <div className="d-grid gap-2">
                  <Button variant="primary" type="submit" disabled={loading}>
                    {loading ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Sending OTP...
                      </>
                    ) : (
                      'Send OTP'
                    )}
                  </Button>
                  <Button 
                    variant="outline-secondary" 
                    onClick={() => navigate('/voter/login')}
                  >
                    Back to Login
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

export default ForgotPassword;