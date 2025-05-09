import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Table, Button, Form, Modal, Alert, Badge } from 'react-bootstrap';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import PageTitle from '../../components/PageTitle';

const ManageElections = () => {
  const { token } = useContext(AuthContext);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for the "Create Election" modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    title: '',
    startTime: '',
    endTime: ''
  });
  const [createValidated, setCreateValidated] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createAlert, setCreateAlert] = useState({ show: false, variant: '', message: '' });
  
  // State for the "Update Election" modal
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateFormData, setUpdateFormData] = useState({
    election_id: null,
    title: '',
    startTime: '',
    endTime: '',
    status: ''
  });
  const [updateValidated, setUpdateValidated] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateAlert, setUpdateAlert] = useState({ show: false, variant: '', message: '' });

  // Fetch all elections
  useEffect(() => {
    const fetchElections = async () => {
      try {
        setLoading(true);
        const config = {
          headers: { Authorization: `Bearer ${token}` }
        };
        
        const response = await axios.get('http://localhost:5000/api/elections', config);
        
        // Sort elections by start time (newest first)
        const sortedElections = response.data.sort((a, b) => 
          new Date(b.start_time) - new Date(a.start_time)
        );
        
        setElections(sortedElections);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching elections:', error);
        setError('Failed to load elections. Please try again.');
        setLoading(false);
      }
    };

    fetchElections();
  }, [token]);

  // Format date for display
  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Format date for input field (YYYY-MM-DDThh:mm)
  const formatDateForInput = (dateString) => {
    const date = new Date(dateString);
    // Create a local timezone date string in the format YYYY-MM-DDThh:mm
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Get status badge
  const getStatusBadge = (status) => {
    if (status === 'active') {
      return <Badge bg="success">Active</Badge>;
    } else if (status === 'upcoming') {
      return <Badge bg="warning" text="dark">Upcoming</Badge>;
    } else {
      return <Badge bg="secondary">Completed</Badge>;
    }
  };

  // Handle changes in create form
  const handleCreateChange = (e) => {
    setCreateFormData({
      ...createFormData,
      [e.target.name]: e.target.value
    });
  };

  // Handle create form submission
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    // Form validation
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setCreateValidated(true);
      return;
    }
    
    // Validate dates - normalize by removing time zone effects
    const startTime = new Date(createFormData.startTime);
    const endTime = new Date(createFormData.endTime);
    const now = new Date();
    
    // For debugging - to ensure we're comparing dates correctly
    console.log('Start time:', startTime.toISOString());
    console.log('End time:', endTime.toISOString());
    console.log('Current time:', now.toISOString());
    
    // Compare dates by converting to milliseconds since epoch
    const endMs = endTime.getTime();
    const nowMs = now.getTime();
    
    // For new elections, end time should be in the future
    if (endMs <= nowMs) {
      setCreateAlert({
        show: true,
        variant: 'danger',
        message: 'End time must be in the future'
      });
      return;
    }
    
    // Check if end time is before start time
    if (endTime <= startTime) {
      setCreateAlert({
        show: true,
        variant: 'danger',
        message: 'End time must be after start time'
      });
      return;
    }
    
    setCreateValidated(true);
    setCreateLoading(true);
    
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      const response = await axios.post(
        'http://localhost:5000/api/elections',
        createFormData,
        config
      );
      
      // Add the new election to the state
      setElections([response.data, ...elections]);
      
      // Clear form and close modal
      setCreateFormData({
        title: '',
        startTime: '',
        endTime: ''
      });
      setCreateValidated(false);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating election:', error);
      setCreateAlert({
        show: true,
        variant: 'danger',
        message: error.response?.data?.message || 'Failed to create election. Please try again.'
      });
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle open update modal
  const handleOpenUpdateModal = (election) => {
    setUpdateFormData({
      election_id: election.election_id,
      title: election.title,
      startTime: formatDateForInput(election.start_time),
      endTime: formatDateForInput(election.end_time),
      status: election.status
    });
    setShowUpdateModal(true);
  };

  // Handle changes in update form
  const handleUpdateChange = (e) => {
    setUpdateFormData({
      ...updateFormData,
      [e.target.name]: e.target.value
    });
  };

  // Handle update form submission
  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    // Form validation
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setUpdateValidated(true);
      return;
    }
    
    // Validate dates - normalize by removing time zone effects
    const startTime = new Date(updateFormData.startTime);
    const endTime = new Date(updateFormData.endTime);
    const now = new Date();
    
    // For debugging - to ensure we're comparing dates correctly
    console.log('Update form - Start time:', startTime.toISOString());
    console.log('Update form - End time:', endTime.toISOString());
    console.log('Update form - Current time:', now.toISOString());
    
    // Compare dates by converting to milliseconds since epoch
    const endMs = endTime.getTime();
    const nowMs = now.getTime();
    
    // For elections, end time should be in the future
    if (updateFormData.status !== 'completed' && endMs <= nowMs) {
      setUpdateAlert({
        show: true,
        variant: 'danger',
        message: 'End time must be in the future for active or upcoming elections'
      });
      return;
    }
    
    // Check if end time is before start time
    if (endTime <= startTime) {
      setUpdateAlert({
        show: true,
        variant: 'danger',
        message: 'End time must be after start time'
      });
      return;
    }
    
    setUpdateValidated(true);
    setUpdateLoading(true);
    
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      const response = await axios.put(
        `http://localhost:5000/api/elections/${updateFormData.election_id}`,
        {
          title: updateFormData.title,
          startTime: updateFormData.startTime,
          endTime: updateFormData.endTime,
          status: updateFormData.status
        },
        config
      );
      
      // Update the election in the state
      setElections(elections.map(election => 
        election.election_id === updateFormData.election_id ? response.data : election
      ));
      
      // Clear form and close modal
      setUpdateValidated(false);
      setShowUpdateModal(false);
    } catch (error) {
      console.error('Error updating election:', error);
      setUpdateAlert({
        show: true,
        variant: 'danger',
        message: error.response?.data?.message || 'Failed to update election. Please try again.'
      });
    } finally {
      setUpdateLoading(false);
    }
  };

  // Update election status
  const updateElectionStatus = async (electionId, newStatus) => {
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      const response = await axios.put(
        `http://localhost:5000/api/elections/${electionId}/status`,
        { status: newStatus },
        config
      );
      
      // Update the election in the state
      setElections(elections.map(election => 
        election.election_id === electionId ? response.data : election
      ));
    } catch (error) {
      console.error('Error updating election status:', error);
      setError('Failed to update election status. Please try again.');
    }
  };

  return (
    <Container>
      <PageTitle title="Manage Elections" />
      <Row className="my-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <h2>Manage Elections</h2>
            <Button variant="primary" onClick={() => setShowCreateModal(true)}>
              Create New Election
            </Button>
          </div>
        </Col>
      </Row>
      
      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <p>Loading elections...</p>
      ) : elections.length === 0 ? (
        <Alert variant="info">No elections found. Create your first election.</Alert>
      ) : (
        <Card className="shadow-sm">
          <Table responsive hover>
            <thead>
              <tr>
                <th>Title</th>
                <th>Start Time</th>
                <th>End Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {elections.map(election => (
                <tr key={election.election_id}>
                  <td>{election.title}</td>
                  <td>{formatDate(election.start_time)}</td>
                  <td>{formatDate(election.end_time)}</td>
                  <td>{getStatusBadge(election.status)}</td>
                  <td>
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      className="me-2"
                      onClick={() => handleOpenUpdateModal(election)}
                    >
                      Edit
                    </Button>
                    
                    {election.status === 'upcoming' && (
                      <Button 
                        variant="outline-success" 
                        size="sm"
                        onClick={() => updateElectionStatus(election.election_id, 'active')}
                      >
                        Start
                      </Button>
                    )}
                    
                    {election.status === 'active' && (
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => updateElectionStatus(election.election_id, 'completed')}
                      >
                        End
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* Create Election Modal */}
      <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create New Election</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {createAlert.show && (
            <Alert 
              variant={createAlert.variant} 
              onClose={() => setCreateAlert({ ...createAlert, show: false })} 
              dismissible
            >
              {createAlert.message}
            </Alert>
          )}
          
          <Form noValidate validated={createValidated} onSubmit={handleCreateSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Election Title</Form.Label>
              <Form.Control
                type="text"
                name="title"
                value={createFormData.title}
                onChange={handleCreateChange}
                required
                placeholder="Enter election title"
              />
              <Form.Control.Feedback type="invalid">
                Please provide an election title.
              </Form.Control.Feedback>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Start Time</Form.Label>
              <Form.Control
                type="datetime-local"
                name="startTime"
                value={createFormData.startTime}
                onChange={handleCreateChange}
                required
              />
              <Form.Control.Feedback type="invalid">
                Please provide a start time.
              </Form.Control.Feedback>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>End Time</Form.Label>
              <Form.Control
                type="datetime-local"
                name="endTime"
                value={createFormData.endTime}
                onChange={handleCreateChange}
                required
              />
              <Form.Control.Feedback type="invalid">
                Please provide an end time.
              </Form.Control.Feedback>
            </Form.Group>
            
            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" disabled={createLoading}>
                {createLoading ? 'Creating...' : 'Create Election'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Update Election Modal */}
      <Modal show={showUpdateModal} onHide={() => setShowUpdateModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Update Election</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {updateAlert.show && (
            <Alert 
              variant={updateAlert.variant} 
              onClose={() => setUpdateAlert({ ...updateAlert, show: false })} 
              dismissible
            >
              {updateAlert.message}
            </Alert>
          )}
          
          <Form noValidate validated={updateValidated} onSubmit={handleUpdateSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Election Title</Form.Label>
              <Form.Control
                type="text"
                name="title"
                value={updateFormData.title}
                onChange={handleUpdateChange}
                required
              />
              <Form.Control.Feedback type="invalid">
                Please provide an election title.
              </Form.Control.Feedback>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Start Time</Form.Label>
              <Form.Control
                type="datetime-local"
                name="startTime"
                value={updateFormData.startTime}
                onChange={handleUpdateChange}
                required
              />
              <Form.Control.Feedback type="invalid">
                Please provide a start time.
              </Form.Control.Feedback>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>End Time</Form.Label>
              <Form.Control
                type="datetime-local"
                name="endTime"
                value={updateFormData.endTime}
                onChange={handleUpdateChange}
                required
              />
              <Form.Control.Feedback type="invalid">
                Please provide an end time.
              </Form.Control.Feedback>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select
                name="status"
                value={updateFormData.status}
                onChange={handleUpdateChange}
                required
              >
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </Form.Select>
            </Form.Group>
            
            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" disabled={updateLoading}>
                {updateLoading ? 'Updating...' : 'Update Election'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default ManageElections;