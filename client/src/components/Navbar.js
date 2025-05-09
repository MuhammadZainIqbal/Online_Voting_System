import React, { useContext, useState, useEffect } from 'react';
import { Navbar as BootstrapNavbar, Nav, Container, Button, NavDropdown, Badge } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faVoteYea, 
  faUserShield, 
  faHome, 
  faClipboardCheck, 
  faUsers, 
  faIdCard, 
  faSignOutAlt, 
  faKey, 
  faChartBar,
  faUser,
  faShieldAlt,
  faMoon,
  faSun
} from '@fortawesome/free-solid-svg-icons';
import { AuthContext } from '../context/AuthContext';

const Navbar = () => {
  const { isAuthenticated, role, user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [navVisible, setNavVisible] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Add animation when component mounts
  useEffect(() => {
    setNavVisible(true);
    
    // Check for saved dark mode preference
    const savedDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(savedDarkMode);
    
    if (savedDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, []);

  // Add scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
    setExpanded(false);
  };

  // Close mobile menu when clicking a link
  const closeMenu = () => setExpanded(false);
  
  // Toggle between light mode and dark mode
  const toggleDarkMode = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    
    localStorage.setItem('darkMode', newDarkMode);
  };

  // Dynamic navbar classes based on scroll state
  const navbarClasses = `py-2 ${scrolled ? 'navbar-scrolled shadow-sm' : ''} custom-navbar ${navVisible ? 'animate-slide-down' : ''}`;

  return (
    <BootstrapNavbar 
      expand="lg" 
      variant="dark" 
      className={navbarClasses} 
      fixed="top"
      expanded={expanded}
      onToggle={(expanded) => setExpanded(expanded)}
    >
      <Container>
        <BootstrapNavbar.Brand as={Link} to="/" className="d-flex align-items-center brand-animation animate-fade-in" onClick={closeMenu}>
          <div className="brand-icon-container me-2">
            <FontAwesomeIcon icon={faVoteYea} className="brand-icon animate-bounce" />
          </div>
          <span className="fw-bold">Secure Vote</span>
        </BootstrapNavbar.Brand>
        
        {/* Night Mode Toggle Button - positioned in navbar */}
        <div 
          className="night-mode-toggle-navbar ms-auto me-2 d-flex d-lg-none" 
          onClick={toggleDarkMode}
          title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          <FontAwesomeIcon icon={darkMode ? faSun : faMoon} />
        </div>
        
        <BootstrapNavbar.Toggle aria-controls="basic-navbar-nav" className="border-0 nav-toggle hover-grow" />
        <BootstrapNavbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <Nav.Link 
              as={Link} 
              to="/" 
              className={`nav-link-custom mx-1 ${location.pathname === '/' ? 'active' : ''} hover-grow stagger-item animate-slide-left`}
              onClick={closeMenu}
            >
              <FontAwesomeIcon icon={faHome} className="me-2" />
              <span>Home</span>
            </Nav.Link>
            
            {/* Voter Links */}
            {isAuthenticated && role === 'voter' && (
              <>
                <Nav.Link 
                  as={Link} 
                  to="/voter/dashboard" 
                  className={`nav-link-custom mx-1 ${location.pathname.includes('/voter/dashboard') ? 'active' : ''} hover-grow stagger-item animate-slide-left`}
                  onClick={closeMenu}
                >
                  <FontAwesomeIcon icon={faClipboardCheck} className="me-2" />
                  <span>Dashboard</span>
                </Nav.Link>
                {/* Removed the Profile link */}
              </>
            )}
            
            {/* Admin Links */}
            {isAuthenticated && role === 'admin' && (
              <>
                <Nav.Link 
                  as={Link} 
                  to="/admin/dashboard" 
                  className={`nav-link-custom mx-1 ${location.pathname.includes('/admin/dashboard') ? 'active' : ''} hover-grow stagger-item animate-slide-left`}
                  onClick={closeMenu}
                >
                  <FontAwesomeIcon icon={faUserShield} className="me-2" />
                  <span>Dashboard</span>
                </Nav.Link>
                <NavDropdown 
                  title={
                    <div className="d-inline-block">
                      <FontAwesomeIcon icon={faChartBar} className="me-2" />
                      <span>Elections</span>
                    </div>
                  }
                  id="admin-elections-dropdown"
                  className={`nav-link-custom mx-1 ${location.pathname.includes('/admin/manage-elections') ? 'active' : ''} hover-grow stagger-item animate-slide-left`}
                >
                  <NavDropdown.Item 
                    as={Link} 
                    to="/admin/manage-elections" 
                    className="dropdown-item-custom hover-grow"
                    onClick={closeMenu}
                  >
                    Manage Elections
                  </NavDropdown.Item>
                  <NavDropdown.Item 
                    as={Link} 
                    to="/admin/dashboard?tab=results" 
                    className="dropdown-item-custom hover-grow"
                    onClick={closeMenu}
                  >
                    View Results
                  </NavDropdown.Item>
                </NavDropdown>
                <Nav.Link 
                  as={Link} 
                  to="/admin/manage-candidates" 
                  className={`nav-link-custom mx-1 ${location.pathname.includes('/admin/manage-candidates') ? 'active' : ''} hover-grow stagger-item animate-slide-left`}
                  onClick={closeMenu}
                >
                  <FontAwesomeIcon icon={faUsers} className="me-2" />
                  <span>Candidates</span>
                </Nav.Link>
                <Nav.Link 
                  as={Link} 
                  to="/admin/register-voter" 
                  className={`nav-link-custom mx-1 ${location.pathname.includes('/admin/register-voter') ? 'active' : ''} hover-grow stagger-item animate-slide-left`}
                  onClick={closeMenu}
                >
                  <FontAwesomeIcon icon={faIdCard} className="me-2" />
                  <span>Register Voter</span>
                </Nav.Link>
                {/* Removed the Settings link */}
              </>
            )}
          </Nav>
          
          <Nav className="d-flex align-items-center">
            {/* Night Mode Toggle Button - desktop view in navbar */}
            <div 
              className="night-mode-toggle-navbar mx-2 d-none d-lg-flex animate-scale-in" 
              onClick={toggleDarkMode}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              <FontAwesomeIcon icon={darkMode ? faSun : faMoon} />
            </div>
            
            {isAuthenticated ? (
              <>
                {role === 'voter' && (
                  <NavDropdown 
                    title={
                      <span className="user-info-dropdown animate-scale-in">
                        <Badge pill bg="light" text="dark" className="me-2 user-badge d-none d-md-inline-block">
                          <FontAwesomeIcon icon={faUser} className="me-1" />
                          {user?.cnic?.substring(0, 5)}...
                        </Badge>
                        <span className="username">{user?.name || "Voter"}</span>
                      </span>
                    } 
                    id="voter-dropdown" 
                    align="end"
                    className="mx-2 custom-dropdown animate-slide-left"
                  >
                    <div className="px-3 py-2 mb-2 d-md-none">
                      <small className="text-muted">Logged in as</small>
                      <p className="mb-0 fw-bold">{user?.name || "Voter"}</p>
                      <small className="text-muted">CNIC: {user?.cnic?.substring(0, 5)}...</small>
                    </div>
                    {/* Removed the Profile link from dropdown */}
                    <NavDropdown.Item as={Link} to="/voter/change-password" className="dropdown-item-custom hover-grow" onClick={closeMenu}>
                      <FontAwesomeIcon icon={faKey} className="me-2" />
                      Change Password
                    </NavDropdown.Item>
                    <NavDropdown.Divider />
                    <NavDropdown.Item onClick={handleLogout} className="dropdown-item-custom hover-grow">
                      <FontAwesomeIcon icon={faSignOutAlt} className="me-2" />
                      Logout
                    </NavDropdown.Item>
                  </NavDropdown>
                )}
                {role === 'admin' && (
                  <NavDropdown 
                    title={
                      <div className="d-flex align-items-center animate-scale-in">
                        <Badge pill bg="warning" text="dark" className="admin-badge pulse">
                          <FontAwesomeIcon icon={faShieldAlt} className="me-1" />
                          Admin
                        </Badge>
                      </div>
                    }
                    id="admin-dropdown" 
                    align="end"
                    className="mx-2 custom-dropdown animate-slide-left"
                  >
                    <div className="px-3 py-2 mb-2">
                      <small className="text-muted">Admin Account</small>
                      <p className="mb-0 fw-bold">{user?.name || "Administrator"}</p>
                    </div>
                    {/* Removed the Profile and Settings links from dropdown */}
                    <NavDropdown.Item onClick={handleLogout} className="dropdown-item-custom hover-grow">
                      <FontAwesomeIcon icon={faSignOutAlt} className="me-2" />
                      Logout
                    </NavDropdown.Item>
                  </NavDropdown>
                )}
              </>
            ) : (
              <>
                <Button as={Link} to="/voter/login" variant="outline-light" className="me-2 login-btn voter-login-btn hover-lift animate-slide-left" onClick={closeMenu}>
                  <FontAwesomeIcon icon={faClipboardCheck} className="me-2" />
                  Voter Login
                </Button>
                <Button as={Link} to="/admin/login" variant="light" className="admin-login-btn hover-lift animate-slide-left" onClick={closeMenu}>
                  <FontAwesomeIcon icon={faUserShield} className="me-2" />
                  Admin Login
                </Button>
              </>
            )}
          </Nav>
        </BootstrapNavbar.Collapse>
      </Container>
    </BootstrapNavbar>
  );
};

export default Navbar;