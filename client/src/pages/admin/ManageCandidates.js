import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Container, Row, Col, Card, Table, Button, Form, Modal, Alert } from 'react-bootstrap';
import axios from 'axios';
import { AuthContext } from '../../context/AuthContext';
import PageTitle from '../../components/PageTitle';

const ManageCandidates = () => {
  const { token } = useContext(AuthContext);
  const [candidates, setCandidates] = useState([]);
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedElection, setSelectedElection] = useState('');
  
  // State for the "Add Candidate" modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormData, setAddFormData] = useState({
    electionId: '',
    name: '',
    party: '',
    symbol: ''
  });
  const [addValidated, setAddValidated] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addAlert, setAddAlert] = useState({ show: false, variant: '', message: '' });
  
  // State for the "Edit Candidate" modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    candidate_id: null,
    name: '',
    party: '',
    symbol: ''
  });
  const [editValidated, setEditValidated] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editAlert, setEditAlert] = useState({ show: false, variant: '', message: '' });

  // Fetch candidates for a specific election
  const fetchCandidates = useCallback(async (electionId) => {
    try {
      setLoading(true);
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      const response = await axios.get(
        `http://localhost:5000/api/candidates?electionId=${electionId}`, 
        config
      );
      
      setCandidates(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setError('Failed to load candidates. Please try again.');
      setLoading(false);
    }
  }, [token]);

  // Fetch all elections
  useEffect(() => {
    const fetchElections = async () => {
      try {
        const config = {
          headers: { Authorization: `Bearer ${token}` }
        };
        
        const response = await axios.get('http://localhost:5000/api/elections', config);
        
        // Filter for active and upcoming elections only
        const activeElections = response.data.filter(
          election => ['active', 'upcoming'].includes(election.status)
        );
        
        setElections(activeElections);
        
        // Set default selected election if there are elections
        if (activeElections.length > 0) {
          setSelectedElection(activeElections[0].election_id);
          fetchCandidates(activeElections[0].election_id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error fetching elections:', error);
        setError('Failed to load elections. Please try again.');
        setLoading(false);
      }
    };

    fetchElections();
  }, [token, fetchCandidates]);

  // (Duplicate fetchCandidates function removed)

  // Handle election change
  const handleElectionChange = (e) => {
    const electionId = e.target.value;
    setSelectedElection(electionId);
    fetchCandidates(electionId);
  };

  // Handle changes in add form
  const handleAddChange = (e) => {
    setAddFormData({
      ...addFormData,
      [e.target.name]: e.target.value
    });
  };

  // Handle opening add modal
  const handleOpenAddModal = () => {
    setAddFormData({
      ...addFormData,
      electionId: selectedElection
    });
    setShowAddModal(true);
  };

  // Handle add form submission
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    // Form validation
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setAddValidated(true);
      return;
    }
    
    setAddValidated(true);
    setAddLoading(true);
    
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      const response = await axios.post(
        'http://localhost:5000/api/candidates',
        addFormData,
        config
      );
      
      // Add the new candidate to the state
      setCandidates([...candidates, response.data]);
      
      // Clear form and close modal
      setAddFormData({
        electionId: selectedElection,
        name: '',
        party: '',
        symbol: ''
      });
      setAddValidated(false);
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding candidate:', error);
      setAddAlert({
        show: true,
        variant: 'danger',
        message: error.response?.data?.message || 'Failed to add candidate. Please try again.'
      });
    } finally {
      setAddLoading(false);
    }
  };

  // Handle open edit modal
  const handleOpenEditModal = (candidate) => {
    setEditFormData({
      candidate_id: candidate.candidate_id,
      name: candidate.name,
      party: candidate.party,
      symbol: candidate.symbol
    });
    setShowEditModal(true);
  };

  // Handle changes in edit form
  const handleEditChange = (e) => {
    setEditFormData({
      ...editFormData,
      [e.target.name]: e.target.value
    });
  };

  // Handle edit form submission
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    
    // Form validation
    if (form.checkValidity() === false) {
      e.stopPropagation();
      setEditValidated(true);
      return;
    }
    
    setEditValidated(true);
    setEditLoading(true);
    
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      const response = await axios.put(
        `http://localhost:5000/api/candidates/${editFormData.candidate_id}`,
        {
          name: editFormData.name,
          party: editFormData.party,
          symbol: editFormData.symbol
        },
        config
      );
      
      // Update the candidate in the state
      setCandidates(candidates.map(candidate => 
        candidate.candidate_id === editFormData.candidate_id ? response.data : candidate
      ));
      
      // Clear form and close modal
      setEditValidated(false);
      setShowEditModal(false);
    } catch (error) {
      console.error('Error updating candidate:', error);
      setEditAlert({
        show: true,
        variant: 'danger',
        message: error.response?.data?.message || 'Failed to update candidate. Please try again.'
      });
    } finally {
      setEditLoading(false);
    }
  };

  // Handle delete candidate
  const handleDeleteCandidate = async (candidateId) => {
    if (!window.confirm('Are you sure you want to delete this candidate?')) {
      return;
    }
    
    try {
      const config = {
        headers: { Authorization: `Bearer ${token}` }
      };
      
      await axios.delete(
        `http://localhost:5000/api/candidates/${candidateId}`,
        config
      );
      
      // Remove the candidate from the state
      setCandidates(candidates.filter(candidate => candidate.candidate_id !== candidateId));
    } catch (error) {
      console.error('Error deleting candidate:', error);
      setError('Failed to delete candidate. Please try again.');
    }
  };

  return (
    <Container>
      <PageTitle title="Manage Candidates" />
      <Row className="mb-4">
        <Col>
          <h2>Manage Candidates</h2>
        </Col>
        <Col className="text-end">
          {selectedElection && (
            <Button variant="primary" onClick={handleOpenAddModal}>
              Add New Candidate
            </Button>
          )}
        </Col>
      </Row>
      
      {elections.length === 0 ? (
        <Alert variant="info">
          No active or upcoming elections available. Create an election first before adding candidates.
        </Alert>
      ) : (
        <>
          <Card className="mb-4 shadow-sm">
            <Card.Body>
              <Form.Group>
                <Form.Label>Select Election</Form.Label>
                <Form.Select
                  value={selectedElection}
                  onChange={handleElectionChange}
                >
                  {elections.map(election => (
                    <option key={election.election_id} value={election.election_id}>
                      {election.title} ({election.status})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Card.Body>
          </Card>

          {error && <Alert variant="danger">{error}</Alert>}

          {loading ? (
            <p>Loading candidates...</p>
          ) : candidates.length === 0 ? (
            <Alert variant="info">
              No candidates found for this election. Add candidates using the button above.
            </Alert>
          ) : (
            <Card className="shadow-sm">
              <Table responsive hover>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Party</th>
                    <th>Symbol</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map(candidate => (
                    <tr key={candidate.candidate_id}>
                      <td>{candidate.name}</td>
                      <td>{candidate.party}</td>
                      <td>{candidate.symbol}</td>
                      <td>
                        <Button 
                          variant="outline-primary" 
                          size="sm" 
                          className="me-2"
                          onClick={() => handleOpenEditModal(candidate)}
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="outline-danger" 
                          size="sm"
                          onClick={() => handleDeleteCandidate(candidate.candidate_id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </>
      )}

      {/* Add Candidate Modal */}
      <Modal show={showAddModal} onHide={() => setShowAddModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add New Candidate</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {addAlert.show && (
            <Alert 
              variant={addAlert.variant} 
              onClose={() => setAddAlert({ ...addAlert, show: false })} 
              dismissible
            >
              {addAlert.message}
            </Alert>
          )}
          
          <Form noValidate validated={addValidated} onSubmit={handleAddSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Election</Form.Label>
              <Form.Select
                name="electionId"
                value={addFormData.electionId}
                onChange={handleAddChange}
                required
              >
                {elections.map(election => (
                  <option key={election.election_id} value={election.election_id}>
                    {election.title}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Candidate Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={addFormData.name}
                onChange={handleAddChange}
                required
                placeholder="Enter candidate name"
              />
              <Form.Control.Feedback type="invalid">
                Please provide a candidate name.
              </Form.Control.Feedback>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Party</Form.Label>
              <Form.Control
                type="text"
                name="party"
                value={addFormData.party}
                onChange={handleAddChange}
                required
                placeholder="Enter party name"
              />
              <Form.Control.Feedback type="invalid">
                Please provide a party name.
              </Form.Control.Feedback>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Symbol</Form.Label>
              <Form.Control
                type="text"
                name="symbol"
                value={addFormData.symbol}
                onChange={handleAddChange}
                required
                placeholder="Enter symbol name"
              />
              <Form.Control.Feedback type="invalid">
                Please provide a symbol name.
              </Form.Control.Feedback>
            </Form.Group>
            
            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" disabled={addLoading}>
                {addLoading ? 'Adding...' : 'Add Candidate'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Edit Candidate Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit Candidate</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editAlert.show && (
            <Alert 
              variant={editAlert.variant} 
              onClose={() => setEditAlert({ ...editAlert, show: false })} 
              dismissible
            >
              {editAlert.message}
            </Alert>
          )}
          
          <Form noValidate validated={editValidated} onSubmit={handleEditSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Candidate Name</Form.Label>
              <Form.Control
                type="text"
                name="name"
                value={editFormData.name}
                onChange={handleEditChange}
                required
              />
              <Form.Control.Feedback type="invalid">
                Please provide a candidate name.
              </Form.Control.Feedback>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Party</Form.Label>
              <Form.Control
                type="text"
                name="party"
                value={editFormData.party}
                onChange={handleEditChange}
                required
              />
              <Form.Control.Feedback type="invalid">
                Please provide a party name.
              </Form.Control.Feedback>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Symbol</Form.Label>
              <Form.Control
                type="text"
                name="symbol"
                value={editFormData.symbol}
                onChange={handleEditChange}
                required
              />
              <Form.Control.Feedback type="invalid">
                Please provide a symbol name.
              </Form.Control.Feedback>
            </Form.Group>
            
            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" disabled={editLoading}>
                {editLoading ? 'Updating...' : 'Update Candidate'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default ManageCandidates;