import { useEffect } from 'react';

const PageTitle = ({ title }) => {
  // Update document title when the component mounts or when title changes
  useEffect(() => {
    // Set the document title - combine with app name for consistency
    document.title = `${title} | Secure Online Voting System`;
    
    // Reset title when component unmounts
    return () => {
      document.title = 'Secure Online Voting System';
    };
  }, [title]);

  // This component doesn't render anything visible
  return null;
};

export default PageTitle;