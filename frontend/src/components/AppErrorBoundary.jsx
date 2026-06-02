import { Component } from 'react';
import TechnicalDifficulties from './TechnicalDifficulties.jsx';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App render error:', error, info);
  }

  handleRetry = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <TechnicalDifficulties
          error={this.state.error}
          title="La página no pudo cargarse"
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}
