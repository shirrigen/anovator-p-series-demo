(function(root){
  'use strict';

  // The pictures, reference marks and diagram pieces are Figma assets.
  // The result component supplies its own values, controls and footer.
  // 1402:21676 · front result artwork and legend on the 360 × 640 device plane.
  const front = `
  <div style="position:absolute;height:553px;left:-21px;top:-4px;width:403px">
    <div style="position:absolute;height:717px;left:0;top:-11px;width:403px" data-pose-art-layer="grid">
      <div style="position:absolute;height:0;left:131px;top:492px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:492px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:474px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:474px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:455px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:455px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:437px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:437px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:419px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:419px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:400px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:400px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:382px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:382px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:363px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:363px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:345px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:345px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:327px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:327px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:308px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:308px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:290px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:290px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:271px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:271px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:253px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:253px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:235px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:235px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:216px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:216px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:198px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:198px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:179px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:179px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:131px;top:161px;width:132px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:128px;top:161px;width:3px">
        <div style="position:absolute;inset:-0.5px 0">
          <img src="assets/posture-ui/result/front/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:331px;left:146px;top:161px;width:0">
        <div style="position:absolute;inset:0 -0.5px">
          <img src="assets/posture-ui/result/front/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:149px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">-30</span>
      <div style="position:absolute;height:331px;left:165px;top:161px;width:0">
        <div style="position:absolute;inset:0 -0.5px">
          <img src="assets/posture-ui/result/front/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:168px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">-20</span>
      <div style="position:absolute;height:331px;left:183px;top:161px;width:0">
        <div style="position:absolute;inset:0 -0.5px">
          <img src="assets/posture-ui/result/front/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:186px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">-10</span>
      <div style="position:absolute;height:331px;left:202px;top:161px;width:0">
        <div style="position:absolute;inset:0 -0.5px">
          <img src="assets/posture-ui/result/front/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:204px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">0</span>
      <div style="position:absolute;height:331px;left:220px;top:161px;width:0">
        <div style="position:absolute;inset:0 -0.5px">
          <img src="assets/posture-ui/result/front/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:223px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">10</span>
      <div style="position:absolute;height:331px;left:238px;top:161px;width:0">
        <div style="position:absolute;inset:0 -0.5px">
          <img src="assets/posture-ui/result/front/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:241px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">20</span>
      <div style="position:absolute;height:331px;left:257px;top:161px;width:0">
        <div style="position:absolute;inset:0 -0.5px">
          <img src="assets/posture-ui/result/front/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:260px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">30</span>
      <div style="position:absolute;background:#000;height:13px;left:131px;top:486px;width:27px"></div>
      <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:487px;width:22px">0</span>
      <div style="position:absolute;background:#000;height:13px;left:131px;top:449px;width:27px"></div>
      <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:450px;width:22px">20</span>
      <div style="position:absolute;background:#000;height:13px;left:131px;top:412px;width:27px"></div>
      <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:413px;width:22px">40</span>
      <div style="position:absolute;background:#000;height:13px;left:131px;top:375px;width:27px"></div>
      <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:377px;width:22px">60</span>
      <div style="position:absolute;background:#000;height:13px;left:131px;top:338px;width:27px"></div>
      <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:340px;width:22px">80</span>
      <div style="position:absolute;background:#000;height:13px;left:131px;top:302px;width:27px"></div>
      <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:303px;width:22px">100</span>
      <div style="position:absolute;background:#000;height:13px;left:131px;top:265px;width:27px"></div>
      <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:266px;width:22px">120</span>
      <div style="position:absolute;background:#000;height:13px;left:131px;top:228px;width:27px"></div>
      <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:229px;width:22px">140</span>
      <div style="position:absolute;background:#000;height:13px;left:131px;top:191px;width:27px"></div>
      <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:193px;width:22px">160</span>
      <div style="position:absolute;background:#000;height:13px;left:131px;top:155px;width:27px"></div>
      <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:156px;width:22px">180</span>
    </div>
    <div style="position:absolute;height:357px;left:109px;overflow:hidden;top:149px;width:184px">
      <div style="position:absolute;height:343px;left:-23px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:16px -5px;mask-size:198px 376px;top:-4px;width:229px;"><img class="pose-public-specimen" data-view="front" src="assets/posture-ui/gold-family-front-side-v01.png" alt="" style="position:absolute;inset:0;object-fit:contain;width:100%;height:100%">
      </div>
      <span class="pose-result-veil"></span>
      <div style="position:absolute;height:138px;left:92px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-99px -34px;mask-size:198px 376px;top:25px;width:0;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <div style="position:absolute;inset:-0.72% -1.5px">
          <img src="assets/posture-ui/result/front/dark-support-bone-observation.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:138px;left:92px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-99px -34px;mask-size:198px 376px;top:25px;width:0;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <div style="position:absolute;inset:-0.72% -1.5px">
          <img src="assets/posture-ui/result/front/illustrative-landmark-connection.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:102px;left:54px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-61px -77px;mask-size:198px 376px;top:68px;width:8px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <div style="position:absolute;inset:-1.03% -18.72% -1.01% -18.74%">
          <img src="assets/posture-ui/result/front/dark-support-bone-observation-1.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:102px;left:54px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-61px -77px;mask-size:198px 376px;top:68px;width:8px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <div style="position:absolute;inset:-1.03% -18.72% -1.01% -18.74%">
          <img src="assets/posture-ui/result/front/illustrative-landmark-connection-1.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:102px;left:122px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-129px -77px;mask-size:198px 376px;top:68px;width:8px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <div style="position:absolute;inset:-1.04% -18.75% -1% -18.71%">
          <img src="assets/posture-ui/result/front/dark-support-bone-observation-2.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:102px;left:122px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-129px -77px;mask-size:198px 376px;top:68px;width:8px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <div style="position:absolute;inset:-1.04% -18.75% -1% -18.71%">
          <img src="assets/posture-ui/result/front/illustrative-landmark-connection-2.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:78px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-85px -171px;mask-size:198px 376px;top:162px;width:27px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <div style="position:absolute;inset:-1.5px -3.7%">
          <img src="assets/posture-ui/result/front/dark-support-bone-observation-3.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:0;left:78px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-85px -171px;mask-size:198px 376px;top:162px;width:27px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <div style="position:absolute;inset:-1.5px -3.7%">
          <img src="assets/posture-ui/result/front/illustrative-landmark-connection-3.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:142px;left:75px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-82px -171px;mask-size:198px 376px;top:162px;width:3px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <div style="position:absolute;inset:-0.71% -50%">
          <img src="assets/posture-ui/result/front/dark-support-bone-observation-4.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:142px;left:75px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-82px -171px;mask-size:198px 376px;top:162px;width:3px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <div style="position:absolute;inset:-0.71% -50%">
          <img src="assets/posture-ui/result/front/illustrative-landmark-connection-4.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:142px;left:106px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-113px -171px;mask-size:198px 376px;top:162px;width:4px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <div style="position:absolute;inset:-0.72% -37.5% -0.71% -37.49%">
          <img src="assets/posture-ui/result/front/dark-support-bone-observation-5.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;height:142px;left:106px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-113px -171px;mask-size:198px 376px;top:162px;width:4px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <div style="position:absolute;inset:-0.72% -37.5% -0.71% -37.49%">
          <img src="assets/posture-ui/result/front/illustrative-landmark-connection-5.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <div style="position:absolute;left:88px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-95px -30px;mask-size:198px 376px;width:8px;height:8px;top:21px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:91px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-98px -33px;mask-size:198px 376px;width:2px;height:2px;top:24px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:88px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-95px -59px;mask-size:198px 376px;width:8px;height:8px;top:50px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:91px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-98px -62px;mask-size:198px 376px;width:2px;height:2px;top:53px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:58px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-65px -73px;mask-size:198px 376px;width:8px;height:8px;top:64px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:61px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-68px -76px;mask-size:198px 376px;width:2px;height:2px;top:67px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:118px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-125px -73px;mask-size:198px 376px;width:8px;height:8px;top:64px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:121px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-128px -76px;mask-size:198px 376px;width:2px;height:2px;top:67px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:53px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-60px -128px;mask-size:198px 376px;width:8px;height:8px;top:119px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:56px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-63px -131px;mask-size:198px 376px;width:2px;height:2px;top:122px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:124px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-131px -128px;mask-size:198px 376px;width:8px;height:8px;top:119px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:127px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-134px -131px;mask-size:198px 376px;width:2px;height:2px;top:122px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:50px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-57px -176px;mask-size:198px 376px;width:8px;height:8px;top:167px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:53px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-60px -179px;mask-size:198px 376px;width:2px;height:2px;top:170px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:126px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-133px -176px;mask-size:198px 376px;width:8px;height:8px;top:167px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:129px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-136px -179px;mask-size:198px 376px;width:2px;height:2px;top:170px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:74px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-81px -167px;mask-size:198px 376px;width:8px;height:8px;top:158px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:77px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-84px -170px;mask-size:198px 376px;width:2px;height:2px;top:161px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:102px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-109px -167px;mask-size:198px 376px;width:8px;height:8px;top:158px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:105px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-112px -170px;mask-size:198px 376px;width:2px;height:2px;top:161px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:72px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-79px -240px;mask-size:198px 376px;width:8px;height:8px;top:231px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:76px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-83px -243px;mask-size:198px 376px;width:2px;height:2px;top:234px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:104px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-111px -240px;mask-size:198px 376px;width:8px;height:8px;top:231px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:107px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-114px -243px;mask-size:198px 376px;width:2px;height:2px;top:234px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:71px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-78px -309px;mask-size:198px 376px;width:8px;height:8px;top:300px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:74px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-81px -312px;mask-size:198px 376px;width:2px;height:2px;top:303px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:106px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-113px -309px;mask-size:198px 376px;width:8px;height:8px;top:300px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:109px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-116px -312px;mask-size:198px 376px;width:2px;height:2px;top:303px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:91px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-98px -170px;mask-size:198px 376px;width:2px;height:2px;top:161px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;left:91px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-98px -170px;mask-size:198px 376px;width:2px;height:2px;top:161px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="bones">
        <img src="assets/posture-ui/result/front/illustrative-landmark-head-center.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <div style="position:absolute;inset:-3.08% 0 3.08% 0;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:-7px 2px;mask-size:198px 376px;mask-image:url('assets/posture-ui/result/front/specimen-mask.svg')" data-pose-art-layer="dimensions">
        <div style="position:absolute;height:3px;left:118px;top:118px;width:15px">
          <div style="position:absolute;inset:-33.33% -6.67%">
            <img src="assets/posture-ui/result/front/upper-arm-rear-dark-separation.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:3px;left:118px;top:118px;width:15px">
          <div style="position:absolute;inset:-16.67% -3.33%">
            <img src="assets/posture-ui/result/front/upper-arm-rear-contour-dashed.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:3px;left:118px;top:121px;width:15px">
          <div style="position:absolute;inset:-50% -10%">
            <img src="assets/posture-ui/result/front/upper-arm-front-dark-separation.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:3px;left:118px;top:121px;width:15px">
          <div style="position:absolute;inset:-16.67% -3.33%">
            <img src="assets/posture-ui/result/front/upper-arm-front-circumference.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:3px;left:118px;top:121px;width:15px">
          <div style="position:absolute;inset:-16.67% -3.33%">
            <img src="assets/posture-ui/result/front/upper-arm-front-fine-highlight.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:5px;left:68px;top:133px;width:48px">
          <div style="position:absolute;inset:-20% -2.08%">
            <img src="assets/posture-ui/result/front/waist-rear-dark-separation.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:5px;left:68px;top:133px;width:48px">
          <div style="position:absolute;inset:-10% -1.04%">
            <img src="assets/posture-ui/result/front/waist-rear-contour-dashed.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:5px;left:68px;top:138px;width:48px">
          <div style="position:absolute;inset:-30% -3.13%">
            <img src="assets/posture-ui/result/front/waist-front-dark-separation.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:5px;left:68px;top:138px;width:48px">
          <div style="position:absolute;inset:-10% -1.04%">
            <img src="assets/posture-ui/result/front/waist-front-circumference.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:5px;left:68px;top:138px;width:48px">
          <div style="position:absolute;inset:-10% -1.04%">
            <img src="assets/posture-ui/result/front/waist-front-fine-highlight.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:5px;left:58px;top:168px;width:68px">
          <div style="position:absolute;inset:-20% -1.47%">
            <img src="assets/posture-ui/result/front/hip-rear-dark-separation.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:5px;left:58px;top:168px;width:68px">
          <div style="position:absolute;inset:-10% -0.74%">
            <img src="assets/posture-ui/result/front/hip-rear-contour-dashed.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:5px;left:58px;top:173px;width:68px">
          <div style="position:absolute;inset:-30% -2.21%">
            <img src="assets/posture-ui/result/front/hip-front-dark-separation.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:5px;left:58px;top:173px;width:68px">
          <div style="position:absolute;inset:-10% -0.74%">
            <img src="assets/posture-ui/result/front/hip-front-circumference.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
        <div style="position:absolute;height:5px;left:58px;top:173px;width:68px">
          <div style="position:absolute;inset:-10% -0.74%">
            <img src="assets/posture-ui/result/front/hip-front-fine-highlight.svg" alt="" style="display:block;width:100%;height:100%">
          </div>
        </div>
      </div>
    </div>
  </div>
  <div style="position:absolute;height:493px;left:0;top:0;width:360px" data-pose-art-layer="risk">
    <img src="assets/posture-ui/result/front/risk-markers.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
  </div>
  <div style="position:absolute;height:3px;left:119px;top:166px;width:61px" data-pose-art-layer="risk">
    <div style="position:absolute;inset:-16.67% 0">
      <img src="assets/posture-ui/result/front/risk-association-head-normal.svg" alt="" style="display:block;width:100%;height:100%">
    </div>
  </div>
  <div style="position:absolute;height:38px;left:119px;top:213px;width:31px" data-pose-art-layer="risk">
    <div style="position:absolute;inset:-1.32% 0">
      <img src="assets/posture-ui/result/front/risk-association-shoulders-high.svg" alt="" style="display:block;width:100%;height:100%">
    </div>
  </div>
  <div style="position:absolute;height:85px;left:119px;top:253px;width:61px" data-pose-art-layer="risk">
    <div style="position:absolute;inset:-0.59% 0">
      <img src="assets/posture-ui/result/front/risk-association-spine-normal.svg" alt="" style="display:block;width:100%;height:100%">
    </div>
  </div>
  <div style="position:absolute;height:29px;left:119px;top:380px;width:45px" data-pose-art-layer="risk">
    <div style="position:absolute;inset:-1.72% 0">
      <img src="assets/posture-ui/result/front/risk-association-oleg-high.svg" alt="" style="display:block;width:100%;height:100%">
    </div>
  </div>
  <div style="position:absolute;height:23px;left:221px;top:256px;width:22px" data-pose-art-layer="dimensions">
    <div style="position:absolute;inset:-2.17% 0">
      <img src="assets/posture-ui/result/front/association-arm-dimension.svg" alt="" style="display:block;width:100%;height:100%">
    </div>
  </div>
  <div style="position:absolute;height:73px;left:205px;top:274px;width:39px" data-pose-art-layer="dimensions">
    <div style="position:absolute;inset:-0.68% 0">
      <img src="assets/posture-ui/result/front/association-waist-dimension.svg" alt="" style="display:block;width:100%;height:100%">
    </div>
  </div>
  <div style="position:absolute;height:93px;left:214px;top:309px;width:29px" data-pose-art-layer="dimensions">
    <div style="position:absolute;inset:-0.54% 0">
      <img src="assets/posture-ui/result/front/association-hip-dimension.svg" alt="" style="display:block;width:100%;height:100%">
    </div>
  </div>
  <div style="position:absolute;height:6px;left:217px;top:207px;width:27px" data-pose-art-layer="dimensions">
    <div style="position:absolute;inset:-8.33% 0">
      <img src="assets/posture-ui/result/front/association-shoulder-width-region-locator.svg" alt="" style="display:block;width:100%;height:100%">
    </div>
  </div>
  <div style="position:absolute;display:flex;gap:6px;align-items:center;left:24px;top:500px;width:312px">
    <div style="display:flex;gap:4px;height:14px;align-items:center;position:relative;flex-shrink:0;width:70px">
      <div style="height:10px;position:relative;flex-shrink:0;width:14px">
        <img src="assets/posture-ui/result/front/visual-key.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <span style="height:14px;line-height:14px;position:relative;flex-shrink:0;font-size:10px;color:var(--ofdl-text-secondary,#bfc2c8);width:52px">Reference</span>
    </div>
    <div style="display:flex;gap:4px;height:14px;align-items:center;position:relative;flex-shrink:0;width:76px">
      <div style="height:10px;position:relative;flex-shrink:0;width:14px">
        <img src="assets/posture-ui/result/front/visual-key-1.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <span style="height:14px;line-height:14px;position:relative;flex-shrink:0;font-size:10px;color:var(--ofdl-text-secondary,#bfc2c8);width:58px">Landmarks</span>
    </div>
    <div style="display:flex;gap:4px;height:14px;align-items:center;position:relative;flex-shrink:0;width:102px">
      <div style="height:10px;position:relative;flex-shrink:0;width:14px">
        <img src="assets/posture-ui/result/front/visual-key-2.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <span style="height:14px;line-height:14px;position:relative;flex-shrink:0;font-size:10px;color:var(--ofdl-text-secondary,#bfc2c8);width:84px">Circumference</span>
    </div>
    <div style="display:flex;gap:4px;height:14px;align-items:center;position:relative;flex-shrink:0;width:46px">
      <div style="height:10px;position:relative;flex-shrink:0;width:14px">
        <div style="position:absolute;inset:-7.07% 0 0 0">
          <img src="assets/posture-ui/result/front/visual-key-3.svg" alt="" style="display:block;width:100%;height:100%">
        </div>
      </div>
      <span style="height:14px;line-height:14px;position:relative;flex-shrink:0;font-size:10px;color:var(--ofdl-text-secondary,#bfc2c8);width:28px">Risk</span>
    </div>
  </div>
  `;

  // 1239:16079 · side result artwork and legend on the 360 × 640 device plane.
  const side = `
  <div style="position:absolute;height:717px;left:-21px;top:-15px;width:403px" data-pose-art-layer="grid">
    <div style="position:absolute;height:0;left:131px;top:492px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:492px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:474px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:474px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:455px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:455px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:437px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:437px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:419px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:419px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:400px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:400px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:382px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:382px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:363px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:363px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:345px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:345px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:327px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:327px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:308px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:308px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:290px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:290px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:271px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:271px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:253px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:253px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:235px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:235px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:216px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:216px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:198px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:198px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:179px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-10.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:179px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:131px;top:161px;width:132px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/reference-horizontal-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:0;left:128px;top:161px;width:3px">
      <div style="position:absolute;inset:-0.5px 0">
        <img src="assets/posture-ui/result/side/tick-0.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <div style="position:absolute;height:331px;left:146px;top:161px;width:0">
      <div style="position:absolute;inset:0 -0.5px">
        <img src="assets/posture-ui/result/side/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:149px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">-30</span>
    <div style="position:absolute;height:331px;left:165px;top:161px;width:0">
      <div style="position:absolute;inset:0 -0.5px">
        <img src="assets/posture-ui/result/side/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:168px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">-20</span>
    <div style="position:absolute;height:331px;left:183px;top:161px;width:0">
      <div style="position:absolute;inset:0 -0.5px">
        <img src="assets/posture-ui/result/side/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:186px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">-10</span>
    <div style="position:absolute;height:331px;left:202px;top:161px;width:0">
      <div style="position:absolute;inset:0 -0.5px">
        <img src="assets/posture-ui/result/side/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:204px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">0</span>
    <div style="position:absolute;height:331px;left:220px;top:161px;width:0">
      <div style="position:absolute;inset:0 -0.5px">
        <img src="assets/posture-ui/result/side/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:223px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">10</span>
    <div style="position:absolute;height:331px;left:238px;top:161px;width:0">
      <div style="position:absolute;inset:0 -0.5px">
        <img src="assets/posture-ui/result/side/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:241px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">20</span>
    <div style="position:absolute;height:331px;left:257px;top:161px;width:0">
      <div style="position:absolute;inset:0 -0.5px">
        <img src="assets/posture-ui/result/side/reference-vertical-30.svg" alt="" style="display:block;width:100%;height:100%">
      </div>
    </div>
    <span style="transform:translateX(-50%);position:absolute;height:12px;line-height:12px;left:260px;color:#666;font-size:9px;text-align:center;top:497px;width:22px">30</span>
    <div style="position:absolute;background:#000;height:13px;left:131px;top:486px;width:27px"></div>
    <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:487px;width:22px">0</span>
    <div style="position:absolute;background:#000;height:13px;left:131px;top:449px;width:27px"></div>
    <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:450px;width:22px">20</span>
    <div style="position:absolute;background:#000;height:13px;left:131px;top:412px;width:27px"></div>
    <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:413px;width:22px">40</span>
    <div style="position:absolute;background:#000;height:13px;left:131px;top:375px;width:27px"></div>
    <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:377px;width:22px">60</span>
    <div style="position:absolute;background:#000;height:13px;left:131px;top:338px;width:27px"></div>
    <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:340px;width:22px">80</span>
    <div style="position:absolute;background:#000;height:13px;left:131px;top:302px;width:27px"></div>
    <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:303px;width:22px">100</span>
    <div style="position:absolute;background:#000;height:13px;left:131px;top:265px;width:27px"></div>
    <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:266px;width:22px">120</span>
    <div style="position:absolute;background:#000;height:13px;left:131px;top:228px;width:27px"></div>
    <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:229px;width:22px">140</span>
    <div style="position:absolute;background:#000;height:13px;left:131px;top:191px;width:27px"></div>
    <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:193px;width:22px">160</span>
    <div style="position:absolute;background:#000;height:13px;left:131px;top:155px;width:27px"></div>
    <span style="transform:translateX(-100%);position:absolute;height:12px;line-height:12px;left:156px;color:#666;font-size:9px;text-align:right;top:156px;width:22px">180</span>
  </div>
  <div style="position:absolute;height:346px;left:91px;overflow:hidden;top:133px;width:178px">
    <div style="position:absolute;height:342px;left:-25px;mask-mode:alpha;mask-clip:no-clip;mask-repeat:no-repeat;mask-position:19px -15px;mask-size:190px 363px;top:7px;width:228px;"><img class="pose-public-specimen" data-view="side" src="assets/posture-ui/gold-family-front-side-v01.png" alt="" style="position:absolute;inset:0;object-fit:contain;width:100%;height:100%">
    </div>
    <span class="pose-result-veil"></span>
  </div>
  <div style="position:absolute;height:490px;left:0;top:0;width:360px" data-pose-art-layer="bones">
    <img src="assets/posture-ui/result/side/landmark-diagram.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
  </div>
  <div style="position:absolute;display:flex;gap:6px;align-items:center;left:24px;top:500px;width:312px">
    <div style="display:flex;gap:4px;align-items:center;position:relative;flex-shrink:0;width:74px">
      <div style="height:10px;position:relative;flex-shrink:0;width:14px">
        <img src="assets/posture-ui/result/side/visual-key.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <span style="line-height:14px;position:relative;flex-shrink:0;font-size:10px;color:var(--ofdl-text-secondary,#bfc2c8);width:56px">Reference</span>
    </div>
    <div style="display:flex;gap:4px;align-items:center;position:relative;flex-shrink:0;width:80px">
      <div style="height:10px;position:relative;flex-shrink:0;width:14px">
        <img src="assets/posture-ui/result/side/visual-key-1.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <span style="line-height:14px;position:relative;flex-shrink:0;font-size:10px;color:var(--ofdl-text-secondary,#bfc2c8);width:62px">Landmarks</span>
    </div>
    <div style="display:flex;gap:4px;align-items:center;position:relative;flex-shrink:0;width:64px">
      <div style="height:10px;position:relative;flex-shrink:0;width:14px">
        <img src="assets/posture-ui/result/side/length-key-bounded-span.svg" alt="" style="position:absolute;display:block;inset:0;width:100%;height:100%">
      </div>
      <span style="line-height:14px;position:relative;flex-shrink:0;font-size:10px;color:var(--ofdl-text-secondary,#bfc2c8);width:46px">Length</span>
    </div>
  </div>
  `;

  const artwork = { front, side };

  function render(view, { grid, bones, risk, dimensions }, faceHidden) {
    return '<div class="pose-result-art" aria-hidden="true" data-view="'+view+
      '" data-grid="'+grid+'" data-bones="'+bones+'" data-risk="'+risk+
      '" data-dimensions="'+dimensions+'" data-face-hidden="'+faceHidden+'">'+
      '<span class="pose-scale-unit" data-pose-art-layer="grid">cm</span>'+artwork[view]+'</div>';
  }

  root.ANOVATOR_POSTURE_RESULT_ART = { render };
})(globalThis);
