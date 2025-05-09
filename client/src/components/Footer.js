import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faShieldAlt, 
  faUserSecret,
  faLink,
  faClipboardCheck
} from '@fortawesome/free-solid-svg-icons';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer-modern py-4 mt-5">
      <Container>
        <Row className="align-items-center mb-4">
          <Col lg={4} md={6} className="mb-4 mb-md-0">
            <div className="d-flex align-items-center mb-3 animate-fade-in">
              <div className="brand-icon-container me-2 pulse-slow">
                <FontAwesomeIcon icon={faShieldAlt} className="brand-icon" />
              </div>
              <h4 className="mb-0">Secure Vote</h4>
            </div>
            <p className="mb-3 text-footer animate-slide-up">
              A blockchain-based secure voting system with advanced cryptographic privacy protections,
              ensuring tamper-proof, anonymous, and verifiable electoral processes.
            </p>
          </Col>
          
          <Col lg={8} md={6}>
            <Row>
              <Col sm={6} lg={4} className="mb-3 mb-lg-0">
                <div className="footer-feature">
                  <FontAwesomeIcon icon={faLink} className="footer-icon" />
                  <span>Blockchain-based</span>
                </div>
              </Col>
              <Col sm={6} lg={4} className="mb-3 mb-lg-0">
                <div className="footer-feature">
                  <FontAwesomeIcon icon={faUserSecret} className="footer-icon" />
                  <span>Voter Anonymity</span>
                </div>
              </Col>
              <Col sm={6} lg={4} className="mb-3 mb-lg-0">
                <div className="footer-feature">
                  <FontAwesomeIcon icon={faClipboardCheck} className="footer-icon" />
                  <span>Verifiable Results</span>
                </div>
              </Col>
            </Row>
          </Col>
        </Row>
        
        <hr className="footer-divider" />
        
        <Row className="align-items-center">
          <Col className="text-center">
            <p className="mb-0 copyright-text">
              &copy; {currentYear} Secure Online Voting System. All rights reserved.
            </p>
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;