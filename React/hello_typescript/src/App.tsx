import React from 'react';
import './App.css';

export interface IAppState {
  myState: string;
}

export class AppComponent extends React.Component<{}, IAppState> {

  public constructor(props: any) {
      super(props);


      this.state = {
          myState: 'Fresh'
      }

      this.handleChange = this.handleChange.bind(this);
  }

  public render(): JSX.Element {
      return (
          <div className="App">
          Type something:
              <input className="text-box" 
                type="text" 
                onChange={this.handleAnswer.bind(this)}
                onKeyUp={this.handleChange}/>
          <br/>
          App state is: {this.state.myState}
          </div>
      );
  }

  private handleChange(event: React.KeyboardEvent<HTMLInputElement>): void 
  {
    if (event.key === 'Enter') {
    }
  }  

  private handleAnswer (event: React.ChangeEvent<HTMLInputElement>): void 
  {
    this.setState({myState: 'Golden'});
  }
}
