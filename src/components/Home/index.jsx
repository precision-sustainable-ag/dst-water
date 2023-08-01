import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import React from 'react';
import { get, set } from '../../store/Store';

import './styles.scss';

const Home = () => {
  const dispatch = useDispatch();
  const privacy = useSelector(get.privacy);

  const className = privacy ? 'home background' : 'home';

  return (
    <>
      <div
        className={className}
      >
        <p>Welcome to the</p>
        <h1>Cover Crop Water Management DST</h1>

        <p>This calculator aids farmers with decision support regarding &hellip;</p>

        <div>
          <Link className="link about" to="/about">ABOUT</Link>
          <Link className="link location" to="/location">GET STARTED</Link>
        </div>

        <img className="crops fullwidth" src="background.png" alt="" />
      </div>

      <div>
        <button
          type="button"
          id="Privacy"
          className="bn"
          onClick={() => dispatch(set.privacy(!privacy))}
        >
          Your privacy
        </button>
        {
          privacy
          && (
          <div id="PrivacyPolicy">
            <button
              type="button"
              className="close"
              onClick={() => dispatch(set.privacy(false))}
            >
              x
            </button>
            <p>Your information is stored on your computer only.  It will not be uploaded to a server.</p>
            <p>If you enter a fieldname, you can select it from the upper-right drop down list the next time you run the program.</p>
            <p>If you clear your browser&apos;s cache, you&apos;ll need to re-enter your data the next time you run the program.</p>
          </div>
          )
        }
      </div>
    </>
  );
}; // Home

export default Home;
