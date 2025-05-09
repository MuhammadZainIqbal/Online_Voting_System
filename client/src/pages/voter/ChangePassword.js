import React, { useState, useContext } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, InputGroup } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import PageTitle from '../../components/PageTitle';

const ChangePassword = () => {
  const { token } = useContext(AuthContext);
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({ show: false, variant: '', message: '' });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { currentPassword, newPassword, confirmPassword } = formData;
  
  const toggleCurrentPassword = () => setShowCurrentPassword(!showCurrentPassword);
  const toggleNewPassword = () => setShowNewPassword(!showNewPassword);
  const toggleConfirmPassword = () => setShowConfirmPassword(!showConfirmPassword);
  
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
    
    if (newPassword !== confirmPassword) {
      setAlert({
        show: true,
        variant: 'danger',
        message: 'New passwords do not match'
      });
      return;
    }
    
    // Password validation
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
      // Set up authorization header
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      // Change password
      const response = await axios.post(
        'http://localhost:5000/api/auth/voter/change-password',
        { 
          currentPassword,
          newPassword,
          confirmPassword 
        },
        config
      );
      
      // If change is successful, show success message
      setAlert({
        show: true,
        variant: 'success',
        message: response.data.message
      });
      
      // Clear the form
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setValidated(false);
    } catch (error) {
      console.error('Error changing password:', error);
      setAlert({
        show: true,
        variant: 'danger',
        message: error.response?.data?.message || 'Failed to change password. Please try again.'
      });
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container>
      <PageTitle title="Change Password" />
      <Row className="justify-content-center my-5">
        <Col lg={6} md={8}>
          <Card className="shadow">
            <Card.Body className="p-4">
              <h2 className="text-center mb-4">Change Password</h2>
              
              {alert.show && (
                <Alert 
                  variant={alert.variant} 
                  onClose={() => setAlert({ ...alert, show: false })} 
                  dismissible
                >
                  {alert.message}
                </Alert>
              )}
              
              <Form noValidate validated={validated} onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>Current Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showCurrentPassword ? "text" : "password"}
                      name="currentPassword"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={onChange}
                      required
                    />
                    <Button variant="outline-secondary" onClick={toggleCurrentPassword}>
                      <FontAwesomeIcon icon={showCurrentPassword ? faEyeSlash : faEye} />
                    </Button>
                  </InputGroup>
                </Form.Group>
                
                <Form.Group className="mb-3">
                  <Form.Label>New Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showNewPassword ? "text" : "password"}
                      name="newPassword"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={onChange}
                      required
                      minLength={8}
                      pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}"
                    />
                    <Button variant="outline-secondary" onClick={toggleNewPassword}>
                      <FontAwesomeIcon icon={showNewPassword ? faEyeSlash : faEye} />
                    </Button>
                  </InputGroup>
                  <Form.Text className="text-muted">
                    Password must be at least 8 characters and include uppercase, lowercase, number, and special character.
                  </Form.Text>
                </Form.Group>
                
                <Form.Group className="mb-4">
                  <Form.Label>Confirm New Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirmPassword"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={onChange}
                      required
                      isInvalid={newPassword !== confirmPassword && confirmPassword !== ''}
                    />
                    <Button variant="outline-secondary" onClick={toggleConfirmPassword}>
                      <FontAwesomeIcon icon={showConfirmPassword ? faEyeSlash : faEye} />
                    </Button>
                    <Form.Control.Feedback type="invalid">
                      Passwords do not match.
                    </Form.Control.Feedback>
                  </InputGroup>
                </Form.Group>
                
                <div className="d-grid">
                  <Button variant="primary" type="submit" disabled={loading}>
                    {loading ? 'Changing Password...' : 'Change Password'}
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

export default ChangePassword;